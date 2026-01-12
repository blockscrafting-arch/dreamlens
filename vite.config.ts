import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // SECURITY: API keys should NEVER be exposed in client bundle
      // For IDX environment, keys are injected at runtime by the platform
      // For local development, users must enter their own keys
      define: {
        // Only define if we're in IDX environment (injected by platform)
        // For production, API keys must be handled server-side or by user input
        'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Production optimizations
        minify: 'esbuild',
        sourcemap: false, // Disable source maps in production for security
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'genai-vendor': ['@google/genai'],
            },
          },
        },
      },
    };
});
