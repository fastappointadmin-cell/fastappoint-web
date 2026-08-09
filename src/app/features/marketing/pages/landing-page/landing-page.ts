import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppLocale } from '../../../../core/i18n/locale';
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

  /**
   * Path is the source of truth for this page's language (/ = ro, /en = en) -- unlike the rest of the
   * app, where the language switcher just flips a persisted preference. `activeLang`'s initial value
   * comes straight from route data (not `transloco.getActiveLang()`) so the very first render -- SSR
   * or prerendered, with no stored preference to fall back on -- is already correct; `setActiveLang`
   * in the constructor below then syncs the real transloco state so every `| transloco` pipe agrees.
   */
  private readonly routeLocale: AppLocale = inject(ActivatedRoute).snapshot.data['locale'] === 'en' ? 'en' : 'ro';
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.routeLocale
  });
  /**
   * `transloco.translate()` is a synchronous snapshot -- on a cold load it can run before the
   * translation file has finished fetching, returning the raw key instead of real text (visible
   * briefly in the browser, but baked in permanently for the prerendered /en HTML, which is only ever
   * captured once). `selectTranslateObject` is Transloco's reactive alternative: it emits `null` until
   * the file is loaded, then the real object, so `applySeo()` only ever runs with real text.
   */
  private readonly seoText = toSignal(
    this.transloco.selectTranslateObject<{ description: string; keywords: string }>(
      'marketing.seo',
      {},
      this.routeLocale
    ),
    { initialValue: null }
  );
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

  /** Example verticals -- not an exhaustive list (see the "more" tile), just enough real business
   * types (researched against actual RO booking-software competitors) to carry the industry keywords
   * naturally in on-page copy instead of only in hidden meta tags. */
  protected readonly industryKeys = [
    { icon: 'bi-scissors', titleKey: 'marketing.industries.type1.title', bodyKey: 'marketing.industries.type1.description' },
    { icon: 'bi-flower1', titleKey: 'marketing.industries.type2.title', bodyKey: 'marketing.industries.type2.description' },
    { icon: 'bi-gem', titleKey: 'marketing.industries.type3.title', bodyKey: 'marketing.industries.type3.description' },
    { icon: 'bi-emoji-smile', titleKey: 'marketing.industries.type4.title', bodyKey: 'marketing.industries.type4.description' },
    { icon: 'bi-hospital', titleKey: 'marketing.industries.type5.title', bodyKey: 'marketing.industries.type5.description' },
    { icon: 'bi-palette', titleKey: 'marketing.industries.type6.title', bodyKey: 'marketing.industries.type6.description' },
    { icon: 'bi-water', titleKey: 'marketing.industries.type7.title', bodyKey: 'marketing.industries.type7.description' },
    { icon: 'bi-heart-pulse', titleKey: 'marketing.industries.type8.title', bodyKey: 'marketing.industries.type8.description' },
    { icon: 'bi-person-arms-up', titleKey: 'marketing.industries.type9.title', bodyKey: 'marketing.industries.type9.description' },
    { icon: 'bi-car-front', titleKey: 'marketing.industries.type10.title', bodyKey: 'marketing.industries.type10.description' },
    { icon: 'bi-camera', titleKey: 'marketing.industries.type11.title', bodyKey: 'marketing.industries.type11.description' }
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
    this.transloco.setActiveLang(this.routeLocale);

    this.stageDelaysMs.forEach((delay, stageIndex) => {
      this.timers.push(setTimeout(() => this.stage.set(stageIndex), delay));
    });

    effect(() => {
      this.activeLang();
      const seo = this.seoText();
      if (seo) {
        this.applySeo(seo.description, seo.keywords);
      }
    });
  }

  ngOnDestroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  protected toggleNav(): void {
    this.navOpen.set(!this.navOpen());
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  private applySeo(description: string, keywords: string): void {
    const activeLang = this.activeLang() === 'ro' ? 'ro' : 'en';
    const alternateLang = activeLang === 'ro' ? 'en' : 'ro';
    // Plain hardcoded literals, not routed through transloco.translate() -- that's what caused the
    // earlier bug where the raw translation key got indexed by Google instead of real text.    
    // routeLocale is resolved synchronously from route data, so there's no async load to race against.
    const title = this.routeLocale === 'ro'
      ? 'FastAppoint - Aplicatie de Programari cu AI, pentru Orice Tip de Business'
      : 'FastAppoint – AI-Powered Appointment Booking App for Any Business';
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
    this.setStructuredData(activeLang, description);
  }

  /**
   * SoftwareApplication + Organization JSON-LD -- lets Google understand what FastAppoint is and
   * show it in rich results for comparison-style queries ("best appointment booking app"), rather
   * than relying on the crawler to infer it from body copy alone.
   */
  private setStructuredData(activeLang: 'en' | 'ro', description: string): void {
    const head = this.document.head;
    if (!head) {
      return;
    }

    let script = head.querySelector('script[type="application/ld+json"]#structured-data');
    if (!(script instanceof HTMLScriptElement)) {
      script = this.document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('id', 'structured-data');
      head.append(script);
    }

    // Mirrors the "industries" section on the page -- gives crawlers the same vertical list as an
    // explicit CreativeWork.keywords property, not just as body copy they'd have to infer.
    const keywords = activeLang === 'ro'
      ? 'programari saloane, programari cabinet stomatologic, programari cabinet medical, programari salon infrumusetare, programari cabinet cosmetica, programari salon masaj si spa, programari cabinet veterinar, programari sala fitness, programari service auto, aplicatie programari online'
      : 'salon booking, dental office booking, medical clinic booking, beauty salon booking, spa and massage booking, veterinary clinic booking, gym booking, auto repair shop booking, online appointment app';

    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: 'FastAppoint',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          url: this.baseUrl,
          description,
          keywords,
          inLanguage: activeLang
        },
        {
          '@type': 'Organization',
          name: 'FastAppoint',
          url: this.baseUrl
        }
      ]
    });
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
    return locale === 'en' ? `${this.baseUrl}en` : this.baseUrl;
  }
}
