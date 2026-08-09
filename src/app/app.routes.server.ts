import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Root path branches on hostname (tenant booking page vs. marketing landing page) via canMatch in
  // app.routes.ts -- that decision needs the real per-request Host header, so this can't be a static
  // prerender; it has to run per request.
  { path: '', renderMode: RenderMode.Server },
  // Purely marketing content, identical for every visitor -- safe (and fastest) to prerender once at
  // build time rather than render it fresh on every request.
  { path: 'en', renderMode: RenderMode.Prerender },
  // Everything else (auth, dashboard, tenant booking-by-id, etc.) keeps the app's existing client-rendered
  // behavior unchanged -- SSR is scoped to just the two marketing routes above to avoid regressions in
  // authenticated/dynamic flows.
  { path: '**', renderMode: RenderMode.Client }
];
