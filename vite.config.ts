import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The landing and the app are two entries:
 *
 *   /        → public/landing.html  (one self-contained file, no build step)
 *   /app     → app.html             (the Vite/React bundle)
 *
 * `public/landing.html` is copied to the build output untouched, so the landing
 * keeps working even if the app is swapped out. Production does the same routing
 * through the rewrites in vercel.json; this middleware makes `npm run dev` and
 * `npm run preview` behave identically, so there is nothing to remember.
 */
function entries() {
  const rewrite = (
    req: { url?: string },
    _res: unknown,
    next: () => void,
  ) => {
    const path = (req.url || '/').split('?')[0];
    if (path === '/') req.url = '/landing.html';
    else if (path === '/app') req.url = '/app.html';
    next();
  };
  return {
    name: 'cooksnipe-entries',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), entries()],
  build: {
    rollupOptions: {
      // The app is no longer the root document — the landing is.
      input: { app: 'app.html' },
    },
  },
  server: {
    proxy: {
      // The launchpad API sends no CORS headers, so it is proxied here in dev and
      // by a rewrite in production.
      '/api': {
        target: 'https://api.momoswap.fun',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
