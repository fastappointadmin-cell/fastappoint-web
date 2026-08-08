import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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

	protected readonly activeLang = toSignal(this.transloco.langChanges$, {
		initialValue: this.transloco.getActiveLang()
	});

	protected setLang(lang: AppLocale): void {
		if (this.activeLang() === lang) {
			return;
		}
		this.transloco.setActiveLang(lang);
		persistLocale(lang);
	}
}
