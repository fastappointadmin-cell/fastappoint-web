import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

export interface MiniCalendarDay {
  isoDate: string;
  dayNumber: number;
  isCurrentMonth: boolean;
}

const WEEKDAY_HEADER_LABELS: Record<string, string[]> = {
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  ro: ['L', 'M', 'M', 'J', 'V', 'S', 'D']
};

/** Grilă lunară compactă (7 coloane), reutilizată oriunde e nevoie de un selector de dată -- sidebar-ul
 * calendarului și selectorul de dată din panoul de editare foloseau anterior marcaj HTML duplicat. */
@Component({
  selector: 'app-mini-calendar',
  imports: [TranslocoPipe],
  templateUrl: './mini-calendar.html',
  styleUrl: './mini-calendar.scss'
})
export class MiniCalendarComponent {
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly monthLabel = input.required<string>();
  readonly days = input.required<MiniCalendarDay[]>();
  /** Data (ISO) evidențiată ca selectată -- comparată per-celulă, ca același set de zile să poată fi
   * "selectat" diferit în funcție de context (ex. ziua vizualizată vs. data unei editări în curs). */
  readonly selectedIsoDate = input<string | null>(null);

  readonly previousMonth = output<void>();
  readonly nextMonth = output<void>();
  readonly dateSelected = output<string>();

  protected readonly weekdayHeaderLabels = computed(() => WEEKDAY_HEADER_LABELS[this.activeLang()]);

  protected isSelected(day: MiniCalendarDay): boolean {
    return day.isoDate === this.selectedIsoDate();
  }
}
