import { Component, computed, input, output, signal } from '@angular/core';

/**
 * Selector de oră (întreagă) stilizat ca restul aplicației -- buton + dropdown, la fel ca mini-calendarul --
 * în loc de <input type="time">, al cărui ceas/dropdown nativ nu se potrivește cu designul aplicației.
 */
@Component({
  selector: 'app-hour-picker',
  templateUrl: './hour-picker.html',
  styleUrl: './hour-picker.scss'
})
export class HourPickerComponent {
  readonly hour = input.required<number>();
  readonly minHour = input(0);
  readonly maxHour = input(23);

  readonly hourChange = output<number>();

  protected readonly isOpen = signal(false);

  protected readonly hourOptions = computed(() => {
    const min = this.minHour();
    const max = this.maxHour();
    return Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index);
  });

  protected toggle(): void {
    this.isOpen.set(!this.isOpen());
  }

  protected select(hour: number): void {
    this.hourChange.emit(hour);
    this.isOpen.set(false);
  }

  protected formatHour(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }
}
