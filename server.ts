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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
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
