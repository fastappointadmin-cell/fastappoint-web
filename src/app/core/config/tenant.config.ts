/**
 * The registered app domain -- every business gets `<slug>.fastappoint.app` automatically (no per-business
 * DNS work: a single wildcard DNS record + wildcard TLS cert, set up once outside this codebase, routes
 * every subdomain to this same app). This constant is what tells the app which hostnames ARE that domain,
 * so it can tell a tenant subdomain apart from the main site.
 */
export const APP_DOMAIN = 'fastappoint.app';

/** Hostnames that are the main site, never a tenant, even though they share the app domain. */
const NON_TENANT_HOSTS = new Set(['fastappoint.app', 'www.fastappoint.app', 'localhost', '127.0.0.1']);

/** Mirrors the backend's reserved-slug list (`BusinessSlugService`) -- no business can ever actually hold
 * one of these as its slug, so a subdomain matching one of these is a system route, not a mistyped tenant
 * lookup that should 404. Without this, visiting e.g. `app.fastappoint.app` would wrongly try (and fail)
 * to resolve a business named "app" instead of falling through to the main site. */
const RESERVED_SUBDOMAINS = new Set([
	'www', 'app', 'api', 'admin', 'mail', 'ftp', 'static', 'assets', 'cdn',
	'book', 'booking', 'dashboard', 'auth', 'login', 'register', 'oauth2', 'docs', 'status'
]);

/**
 * Pulls the business slug out of the current hostname, if any -- e.g. `riverside.fastappoint.app` ->
 * `"riverside"`. Returns null on the main domain/www, on localhost with no subdomain, or on an IP.
 * Also supports `<slug>.localhost` for local dev: modern browsers resolve any `*.localhost` hostname to
 * the loopback address with no `/etc/hosts` edit needed, so this lets subdomain routing be tested without
 * touching real DNS at all.
 */
export function resolveTenantSlug(hostname: string = window.location.hostname): string | null {
	if (NON_TENANT_HOSTS.has(hostname)) {
		return null;
	}

	const suffix = hostname.endsWith(`.${APP_DOMAIN}`) ? `.${APP_DOMAIN}` : hostname.endsWith('.localhost') ? '.localhost' : null;
	if (!suffix) {
		return null;
	}

	const slug = hostname.slice(0, -suffix.length);
	return slug && !slug.includes('.') && !RESERVED_SUBDOMAINS.has(slug) ? slug : null;
}
