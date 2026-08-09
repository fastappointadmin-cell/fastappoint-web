import { Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppLocale, persistLocale } from '../../core/i18n/locale';

/** A two-way EN/RO toggle, reused on every page shell (landing nav, auth page, booking page,
 * dashboard header) -- the language is app-wide, not per-page, so there's exactly one component
 * for it rather than each shell rolling its own. */
@Component({
	selector: 'app-language-switcher',
	imports: [TranslocoPipe],
	templateUrl: './language-switcher.html',
	styleUrl: './language-switcher.scss'
})
export class LanguageSwitcher {
	private readonly transloco = inject(TranslocoService);
	private readonly router = inject(Router);

	/** 'marketing' navigates between the path-based `/` and `/en` marketing routes instead of flipping
	 * a persisted preference in place -- the URL is the source of truth for that page's language (needed
	 * for SEO/SSR). Every other page shell keeps the default 'app' behavior. */
	readonly mode = input<'app' | 'marketing'>('app');

	protected readonly activeLang = toSignal(this.transloco.langChanges$, {
		initialValue: this.transloco.getActiveLang()
	});

	protected setLang(lang: AppLocale): void {
		if (this.activeLang() === lang) {
			return;
		}
		if (this.mode() === 'marketing') {
			this.router.navigateByUrl(lang === 'en' ? '/en' : '/');
			return;
		}
		this.transloco.setActiveLang(lang);
		persistLocale(lang);
	}
}
