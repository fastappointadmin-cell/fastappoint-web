export type AppLocale = 'en' | 'ro';

export const AVAILABLE_LOCALES: AppLocale[] = ['en', 'ro'];

const STORAGE_KEY = 'fastappoint_locale';

/**
 * Romanian by default -- the app's primary audience. English only once the visitor explicitly
 * switches to it via the language switcher, which persists here and wins on every later visit.
 *
 * Called directly in `app.config.ts`'s providers array at module-evaluation time, outside any
 * injection context (no `inject()`/`isPlatformBrowser()` available yet) -- on the server there's no
 * `window` at all, so this guards with a plain `typeof` check instead. The marketing landing page
 * doesn't rely on this: its language comes from the URL path (`/` vs `/en`), forced explicitly in its
 * own constructor. This is only the app-wide fallback for every other page (auth, dashboard, booking).
 */
export function resolveInitialLocale(): AppLocale {
	if (typeof window === 'undefined') {
		return 'ro';
	}

	const urlLocale = readLocaleFromUrl();
	if (urlLocale) {
		return urlLocale;
	}

	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'en' || stored === 'ro' ? stored : 'ro';
}

export function persistLocale(locale: AppLocale): void {
	if (typeof window === 'undefined') {
		return;
	}
	localStorage.setItem(STORAGE_KEY, locale);
}

function readLocaleFromUrl(): AppLocale | null {
	const lang = new URLSearchParams(window.location.search).get('lang');
	return lang === 'en' || lang === 'ro' ? lang : null;
}
