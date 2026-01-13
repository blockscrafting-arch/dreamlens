/**
 * Express server for Railway deployment
 * Handles both static files and API routes
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// API handlers
import generateImage from './api/generate/image.js';
import generateIdea from './api/generate/idea.js';
import generateStatus from './api/generate/status.js';
import tokensHandler from './api/tokens/index.js';
import userHandler from './api/user/index.js';
import healthHandler from './api/health/index.js';
import telegramWebhook from './api/payments/telegram-webhook.js';
import telegramStars from './api/payments/telegram-stars.js';
import generationsHandler from './api/generations/index.js';
import initDbHandler from './api/init-db/index.js';

// Environment variables validation
function validateEnv() {
  const required = ['POSTGRES_URL'];
  const recommended = ['TELEGRAM_BOT_TOKEN', 'GEMINI_API_KEY', 'ALLOWED_ORIGINS'];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  const missingRecommended = recommended.filter(key => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(`⚠️ Missing recommended env vars: ${missingRecommended.join(', ')}`);
  }
}

validateEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration with allowed origins from env
// Normalize origins: trim whitespace and remove trailing slashes
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(o => o.length > 0) || [];

// #region agent log
console.log('[DEBUG-CORS] Startup config:', JSON.stringify({allowedOrigins,allowedOriginsRaw:process.env.ALLOWED_ORIGINS,nodeEnv:process.env.NODE_ENV,originsCount:allowedOrigins.length}));
// #endregion

app.use(cors({
  origin: (origin, callback) => {
    // Normalize incoming origin (remove trailing slash)
    const normalizedOrigin = origin?.replace(/\/+$/, '');
    // #region agent log
    console.log('[DEBUG-CORS] Check:', JSON.stringify({incomingOrigin:origin,normalizedOrigin,allowedOrigins,nodeEnv:process.env.NODE_ENV,isInList:allowedOrigins.includes(normalizedOrigin||''),isProduction:process.env.NODE_ENV==='production'}));
    // #endregion
    // Allow requests with no origin (mobile apps, curl, Telegram WebApp, etc.)
    if (!origin) return callback(null, true);
    // Allow if origin is in the list or if not in production
    if (allowedOrigins.includes(normalizedOrigin!) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // #region agent log
    console.log('[DEBUG-CORS] DENIED:', JSON.stringify({deniedOrigin:origin,normalizedOrigin,allowedOrigins,nodeEnv:process.env.NODE_ENV}));
    // #endregion
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Rate limiting middleware (in-memory, resets on restart)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

app.use((req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100; // 100 requests per minute per IP
  
  const record = requestCounts.get(ip);
  if (!record || record.resetTime < now) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
  } else if (record.count >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  } else {
    record.count++;
  }
  next();
});

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (record.resetTime < now) {
      requestCounts.delete(ip);
    }
  }
}, 60000);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Adapter for Vercel-style handlers
const adaptHandler = (handler: any) => async (req: express.Request, res: express.Response) => {
  try {
    // Add Vercel-compatible properties
    (req as any).query = req.query;
    await handler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// API Routes
app.all('/api/generate/image', adaptHandler(generateImage));
app.all('/api/generate/idea', adaptHandler(generateIdea));
app.all('/api/generate/status', adaptHandler(generateStatus));
app.all('/api/tokens', adaptHandler(tokensHandler));
app.all('/api/tokens/*', adaptHandler(tokensHandler));
app.all('/api/user', adaptHandler(userHandler));
app.all('/api/user/*', adaptHandler(userHandler));
app.all('/api/health', adaptHandler(healthHandler));
app.all('/api/payments/telegram-webhook', adaptHandler(telegramWebhook));
app.all('/api/payments/telegram-stars', adaptHandler(telegramStars));
app.all('/api/generations', adaptHandler(generationsHandler));
app.all('/api/generations/*', adaptHandler(generationsHandler));
app.all('/api/init-db', adaptHandler(initDbHandler));

// Serve static files from dist folder (go up from dist-server to project root)
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 DreamLens API server running on port ${PORT}`);
  console.log(`📁 Serving static files from ${distPath}`);
  console.log(`🔗 API endpoints available at /api/*`);
});

export default app;
