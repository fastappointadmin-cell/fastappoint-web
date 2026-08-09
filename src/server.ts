import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Proxies REST/OAuth/WebSocket traffic straight to the backend, taking over what nginx used to do in
 * front of the static build. Mounted with `app.use(proxy)` (no path prefix) and filtered via
 * `pathFilter` instead of `app.use(prefix, proxy)`, because Express strips the mount prefix from
 * `req.url` inside path-mounted middleware -- that would send the backend `/public/contact/messages`
 * instead of `/api/public/contact/messages`. BACKEND_URL is required in real deployments; the
 * localhost fallback only matters for running the built SSR server against a local backend.
 */
const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';
const backendProxy = createProxyMiddleware({
  target: backendUrl,
  changeOrigin: true,
  ws: true,
  pathFilter: ['/api', '/oauth2', '/login/oauth2', '/ws'],
});

app.use(backendProxy);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  const server = app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
  // The chat WebSocket doesn't reliably arrive as a plain HTTP request first, so subscribe to the
  // server's 'upgrade' event directly rather than relying on http-proxy-middleware's auto-detection.
  server.on('upgrade', backendProxy.upgrade);
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
