import { Component, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
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
  }

  ngOnDestroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  protected toggleNav(): void {
    this.navOpen.set(!this.navOpen());
  }
}
