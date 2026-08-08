import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { formatCalendarMinutes } from '../calendar-board/calendar-board.utils';

/**
 * Selector de oră cu minute (pas configurabil) stilizat ca restul aplicației -- buton + dropdown, la fel ca
 * app-hour-picker, dar operând pe minute-din-zi în loc de ore întregi (folosit unde granularitatea de o oră
 * întreagă nu e suficientă, ex. orele de start/sfârșit ale disponibilității recurente).
 */
@Component({
  selector: 'app-time-picker',
  imports: [TranslocoPipe],
  templateUrl: './time-picker.html',
  styleUrl: './time-picker.scss'
})
export class TimePickerComponent {
  private readonly transloco = inject(TranslocoService);

  readonly minutes = input<number | null>(null);
  readonly stepMinutes = input(30);
  readonly minMinutes = input(0);
  readonly maxMinutes = input(23 * 60 + 30);
  /** Când e true, dropdown-ul are o primă opțiune pentru "fără valoare" (null) -- pentru câmpuri opționale. */
  readonly allowClear = input(false);
  /** Translation key, not literal text. */
  readonly clearLabel = input('dashboard.common.anyTime');

  readonly minutesChange = output<number | null>();

  protected readonly isOpen = signal(false);

  protected readonly options = computed(() => {
    const step = this.stepMinutes();
    const min = this.minMinutes();
    const max = this.maxMinutes();
    const count = Math.max(0, Math.floor((max - min) / step) + 1);
    return Array.from({ length: count }, (_, index) => min + index * step);
  });

  protected toggle(): void {
    this.isOpen.set(!this.isOpen());
  }

  protected select(value: number | null): void {
    this.minutesChange.emit(value);
    this.isOpen.set(false);
  }

  protected format(value: number | null): string {
    return value === null ? this.transloco.translate(this.clearLabel()) : formatCalendarMinutes(value);
  }
}
