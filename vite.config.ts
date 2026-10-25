import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import ytSearch from 'yt-search';
import { spawn } from 'child_process';

const ytDlpPath = path.resolve(__dirname, 'node_modules/youtube-dl-exec/bin/yt-dlp.exe');

export default defineConfig(() => {
  return {
    // './' is required so Electron can open index.html with file:// protocol
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'yt-search-api',
        configureServer(server) {
          server.middlewares.use('/api/search', async (req, res, next) => {
            try {
              const url = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
              const query = url.searchParams.get('q');
              if (query) {
                const r = await ytSearch(query);
                const videoId = r.videos[0]?.videoId || null;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ videoId }));
                return;
              }
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: (e as any).message }));
              return;
            }
            next();
          });

          server.middlewares.use('/api/stream', async (req, res, next) => {
            try {
              const url = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
              const videoId = url.searchParams.get('id');
              if (!videoId) { next(); return; }

              res.setHeader('Content-Type', 'audio/mp4');
              res.setHeader('Transfer-Encoding', 'chunked');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
              res.setHeader('Cache-Control', 'no-cache');

              const cp = spawn(ytDlpPath, [
                `https://www.youtube.com/watch?v=${videoId}`,
                '--extractor-args', 'youtube:player_client=android,web',
                '-f', 'ba/b',
                '-o', '-',
                '--no-warnings'
              ]);

              cp.stdout.pipe(res);
              cp.stderr.on('data', () => {});
              cp.on('error', (err) => {
                console.error('[Harami stream error]:', err.message);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
              });

              req.on('close', () => {
                try { cp.kill(); } catch {}
              });

            } catch (e: any) {
              console.error('Stream error:', e.message);
              if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
