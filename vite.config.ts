import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import url from 'url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables (including non-VITE_ ones) into process.env
  // so serverless function handlers can access MONGODB_URI, JWT_SECRET, etc.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key in env) {
    if (!process.env[key]) {
      process.env[key] = env[key];
    }
  }

  // Plugin: intercepts /api/* requests and runs local serverless handlers
  const apiMiddlewarePlugin = {
    name: 'local-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url) return next();

        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname;

        // Only intercept internal /api/ routes; let proxy routes pass through
        if (
          pathname.startsWith('/api/') &&
          !pathname.startsWith('/api/upcitemdb') &&
          !pathname.startsWith('/api/openfoodfacts')
        ) {
          let filePath = '';
          let query: Record<string, string> = {};

          if (pathname === '/api/auth/register') {
            filePath = './api/auth/register.js';
          } else if (pathname === '/api/auth/login') {
            filePath = './api/auth/login.js';
          } else if (pathname === '/api/auth/google') {
            filePath = './api/auth/google.js';
          } else if (pathname === '/api/health') {
            filePath = './api/health.js';
          } else if (pathname === '/api/items') {
            filePath = './api/items/index.js';
          } else if (pathname.startsWith('/api/items/')) {
            const id = pathname.substring('/api/items/'.length);
            filePath = './api/items/[id].js';
            query = { id };
          } else if (pathname === '/api/products') {
            filePath = './api/products/index.js';
          } else if (pathname.startsWith('/api/products/')) {
            const id = pathname.substring('/api/products/'.length);
            filePath = './api/products/[id].js';
            query = { id };
          } else if (pathname === '/api/whatsapp/send') {
            filePath = './api/whatsapp/send.js';
          } else if (pathname === '/api/vision/ocr') {
            filePath = './api/vision/ocr.js';
          } else {
            return next();
          }

          try {
            // Parse JSON body for POST/PUT/PATCH/DELETE
            let body: any = {};
            if (req.method !== 'GET' && req.method !== 'OPTIONS' && req.method !== 'HEAD') {
              body = await new Promise((resolve) => {
                let chunkStr = '';
                req.on('data', (chunk: Buffer) => {
                  chunkStr += chunk.toString();
                });
                req.on('end', () => {
                  try {
                    resolve(chunkStr ? JSON.parse(chunkStr) : {});
                  } catch {
                    resolve({});
                  }
                });
              });
            }

            // Attach body and query to request object
            req.body = body;
            req.query = query;

            // Add Vercel-style response helpers
            res.status = function (code: number) {
              res.statusCode = code;
              return res;
            };
            res.json = function (data: any) {
              if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/json');
              }
              res.end(JSON.stringify(data));
              return res;
            };
            res.send = function (data: any) {
              res.end(data);
              return res;
            };

            // Dynamically import and invoke the serverless handler
            const absolutePath = path.resolve(filePath);
            const fileUrl = url.pathToFileURL(absolutePath).href;
            const mod = await import(fileUrl);
            await mod.default(req, res);
          } catch (err: any) {
            console.error('[API Middleware] Handler error:', err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message }));
            }
          }
        } else {
          next();
        }
      });
    }
  };

  return {
    plugins: [react(), apiMiddlewarePlugin],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Proxy UPCitemdb API to avoid CORS issues
        '/api/upcitemdb': {
          target: 'https://api.upcitemdb.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/upcitemdb/, '')
        },
        // Proxy Open Food Facts API to avoid CORS issues
        '/api/openfoodfacts': {
          target: 'https://world.openfoodfacts.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/openfoodfacts/, '/api/v0')
        }
      }
    }
  }
})
