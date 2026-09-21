import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import ytSearch from 'yt-search';
import youtubedl from 'youtube-dl-exec';
import https from 'https';

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

              // Use youtube-dl-exec to get the deciphered direct URL
              const output: any = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, { dumpJson: true, noWarnings: true });
              
              // Find the best audio-only format (usually m4a or webm)
              const format = output.formats.reverse().find((f: any) => f.vcodec === 'none' && f.acodec !== 'none') || output.formats[0];
              if (!format || !format.url) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'No audio format found' }));
                return;
              }

              res.setHeader('Content-Type', format.ext === 'webm' ? 'audio/webm' : 'audio/mp4');
              res.setHeader('Transfer-Encoding', 'chunked');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'no-cache');

              // Proxy the audio stream
              https.get(format.url, (proxyRes) => {
                proxyRes.pipe(res);
                proxyRes.on('error', (err) => {
                  console.error('Proxy stream error:', err.message);
                  if (!res.headersSent) { res.statusCode = 500; res.end(); }
                  else { res.end(); }
                });
              }).on('error', (err) => {
                console.error('HTTPS get error:', err.message);
                if (!res.headersSent) { res.statusCode = 500; res.end(); }
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
