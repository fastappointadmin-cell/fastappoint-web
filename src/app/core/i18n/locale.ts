export type AppLocale = 'en' | 'ro';

export const AVAILABLE_LOCALES: AppLocale[] = ['en', 'ro'];

const STORAGE_KEY = 'fastappoint_locale';

/** Romanian by default -- the app's primary audience. English only once the visitor explicitly
 * switches to it via the language switcher, which persists here and wins on every later visit. */
export function resolveInitialLocale(): AppLocale {
	const urlLocale = readLocaleFromUrl();
	if (urlLocale) {
		return urlLocale;
	}

	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'en' || stored === 'ro' ? stored : 'ro';
}

export function persistLocale(locale: AppLocale): void {
	localStorage.setItem(STORAGE_KEY, locale);
}

function readLocaleFromUrl(): AppLocale | null {
	const lang = new URLSearchParams(window.location.search).get('lang');
	return lang === 'en' || lang === 'ro' ? lang : null;
}
