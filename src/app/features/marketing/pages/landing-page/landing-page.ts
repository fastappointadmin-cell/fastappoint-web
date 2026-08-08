import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageSwitcher } from '../../../../shared/language-switcher/language-switcher';

interface SelfServiceSlot {
  time: string;
  available: boolean;
}

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, TranslocoPipe, LanguageSwitcher],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss'
})
export class LandingPage implements OnDestroy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang()
  });
  private readonly baseUrl = 'https://fastappoint.app/';

  protected readonly navOpen = signal(false);

  /** Translation keys, not text -- rendered through the transloco pipe in the template so the list
   * re-translates along with everything else on a language switch. */
  protected readonly appFeatureKeys = [
    'marketing.channels.app.feature1',
    'marketing.channels.app.feature2',
    'marketing.channels.app.feature3',
    'marketing.channels.app.feature4'
  ];

  protected readonly whatsappFeatureKeys = [
    'marketing.channels.whatsapp.feature1',
    'marketing.channels.whatsapp.feature2',
    'marketing.channels.whatsapp.feature3',
    'marketing.channels.whatsapp.feature4'
  ];

  protected readonly stepKeys = [
    { titleKey: 'marketing.steps.step1.title', bodyKey: 'marketing.steps.step1.body' },
    { titleKey: 'marketing.steps.step2.title', bodyKey: 'marketing.steps.step2.body' },
    { titleKey: 'marketing.steps.step3.title', bodyKey: 'marketing.steps.step3.body' }
  ];

  protected readonly selfServiceSlots: SelfServiceSlot[] = [
    { time: '9:00', available: true },
    { time: '10:30', available: false },
    { time: '2:00', available: true },
    { time: '3:30', available: true }
  ];

  /** The slot the self-service mockup "clicks" -- same 3:30 the WhatsApp thread books, so both hero
   * mockups visibly land on the exact same outcome, just reached two different ways. */
  protected readonly selfServicePickIndex = 3;

  /**
   * One shared clock drives both hero mockups so they play out in lockstep -- reinforcing "two paths,
   * same result" rather than reading as two unrelated animations. Plain setTimeout chain (not CSS
   * keyframes): the WhatsApp typing indicator needs to appear only BETWEEN specific messages, which is
   * easier to express as named stages than to keep several keyframe timelines in sync by hand. Runs
   * once on page entry and stops -- no reset, no re-loop.
   */
  protected readonly stage = signal(0);
  private readonly stageDelaysMs = [0, 900, 1900, 2600, 3600, 4300, 5300, 6000];
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  protected readonly showMsg1 = computed(() => this.stage() >= 1);
  protected readonly showTyping1 = computed(() => this.stage() === 2);
  protected readonly showMsg2 = computed(() => this.stage() >= 3);
  protected readonly showMsg3 = computed(() => this.stage() >= 4);
  protected readonly showTyping2 = computed(() => this.stage() === 5);
  protected readonly showMsg4 = computed(() => this.stage() >= 6);

  protected readonly showSlots = computed(() => this.stage() >= 1);
  protected readonly slotPicked = computed(() => this.stage() >= 2);
  protected readonly showBooked = computed(() => this.stage() >= 5);

  constructor() {
    this.stageDelaysMs.forEach((delay, stageIndex) => {
      this.timers.push(setTimeout(() => this.stage.set(stageIndex), delay));
    });

    effect(() => {
      this.activeLang();
      this.applySeo();
    });
  }

  ngOnDestroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  protected toggleNav(): void {
    this.navOpen.set(!this.navOpen());
  }

  private applySeo(): void {
    const activeLang = this.activeLang() === 'ro' ? 'ro' : 'en';
    const alternateLang = activeLang === 'ro' ? 'en' : 'ro';
    const title = this.transloco.translate('marketing.seo.title');
    const description = this.transloco.translate('marketing.seo.description');
    const keywords = this.transloco.translate('marketing.seo.keywords');
    const locale = activeLang === 'ro' ? 'ro_RO' : 'en_US';
    const localeUrl = this.toLocaleUrl(activeLang);

    this.title.setTitle(title);
    this.document.documentElement.lang = activeLang;
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'keywords', content: keywords });
    this.meta.updateTag({ name: 'robots', content: 'index,follow' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'FastAppoint' });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: localeUrl });
    this.meta.updateTag({ property: 'og:locale', content: locale });
    this.meta.updateTag({
      property: 'og:locale:alternate',
      content: alternateLang === 'ro' ? 'ro_RO' : 'en_US'
    });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    this.setCanonicalUrl(localeUrl);
    this.setAlternateUrl('en', this.toLocaleUrl('en'));
    this.setAlternateUrl('ro', this.toLocaleUrl('ro'));
    this.setAlternateUrl('x-default', this.baseUrl);
  }

  private setCanonicalUrl(url: string): void {
    const head = this.document.head;
    if (!head) {
      return;
    }

    let canonical = head.querySelector('link[rel="canonical"]');
    if (!(canonical instanceof HTMLLinkElement)) {
      canonical = this.document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      head.append(canonical);
    }

    canonical.setAttribute('href', url);
  }

  private setAlternateUrl(hreflang: string, url: string): void {
    const head = this.document.head;
    if (!head) {
      return;
    }

    let alternate = head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
    if (!(alternate instanceof HTMLLinkElement)) {
      alternate = this.document.createElement('link');
      alternate.setAttribute('rel', 'alternate');
      alternate.setAttribute('hreflang', hreflang);
      head.append(alternate);
    }

    alternate.setAttribute('href', url);
  }

  private toLocaleUrl(locale: 'en' | 'ro'): string {
    const url = new URL(this.baseUrl);
    url.searchParams.set('lang', locale);
    return url.toString();
  }
}
