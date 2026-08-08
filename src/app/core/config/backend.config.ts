/**
 * Empty on purpose: all API calls resolve to a path relative to the app's own origin (e.g. `/api/...`),
 * proxied to the backend by `ng serve` (see proxy.conf.json). This makes the browser see every request
 * as same-origin -- required for the httpOnly refresh-token cookie to actually persist. A `SameSite=None`
 * cross-origin cookie depends on the browser treating `http://localhost` as a secure context, which isn't
 * reliable across browsers/versions; same-origin sidesteps the whole problem instead of hoping for that
 * exemption to hold. In a real deployment this stays empty too, as long as the frontend and API are served
 * through the same origin/reverse proxy -- if they ever aren't, this needs to become that origin's URL.
 */
export const backendConfig = {
  baseUrl: ''
} as const;
