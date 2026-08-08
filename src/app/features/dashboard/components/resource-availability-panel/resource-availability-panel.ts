import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardApiService } from '../../data-access/dashboard-api.service';
import { CalendarBoardComponent } from '../calendar-board/calendar-board';
import {
  CalendarBoardDay,
  CalendarBoardInterval,
  CalendarBoardTrack,
  calendarIntervalDurationLabel,
  formatCalendarMinutes,
  parseCalendarTime
} from '../calendar-board/calendar-board.utils';
import { MiniCalendarComponent, MiniCalendarDay } from '../mini-calendar/mini-calendar';
import { HourPickerComponent } from '../hour-picker/hour-picker';
import { TimePickerComponent } from '../time-picker/time-picker';

type AvailabilityPanelMode = 'recurring' | 'custom';

interface AvailabilityBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface ResourceAvailabilityResponseItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

const WEEKDAY_LABELS: Record<string, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ro: ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']
};
/** Display order Mon..Sun; values are JS Date#getDay() (0 = Sunday). */
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const INTL_LOCALES: Record<string, string> = { en: 'en-US', ro: 'ro-RO' };

@Component({
  selector: 'app-resource-availability-panel',
  imports: [FormsModule, CalendarBoardComponent, MiniCalendarComponent, HourPickerComponent, TimePickerComponent, TranslocoPipe],
  templateUrl: './resource-availability-panel.html',
  styleUrl: './resource-availability-panel.scss'
})
export class ResourceAvailabilityPanel {
  private readonly api = inject(DashboardApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly resourceId = input.required<string>();

  protected readonly weekdayOrder = WEEKDAY_DISPLAY_ORDER;
  protected readonly weekdayLabels = computed(() => WEEKDAY_LABELS[this.activeLang()]);
  protected readonly parseCalendarTime = parseCalendarTime;

  protected readonly mode = signal<AvailabilityPanelMode>('recurring');
  protected readonly availability = signal<AvailabilityBlock[]>([]);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /** Formular recurent: zile din săptămână + interval orar + fereastra de date pe care se aplică. */
  protected readonly recurringWeekdays = signal<Set<number>>(new Set([1, 2, 3, 4, 5]));
  protected readonly recurringStartTime = signal('09:00');
  protected readonly recurringEndTime = signal('17:00');
  protected readonly recurringStartDate = signal(this.toLocalIsoDate(new Date()));
  protected readonly recurringWeeks = signal(4);
  /** Aceeași idee ca `customCalendarAnchor`, dar pentru mini-calendarul "Starting from" din formularul recurent. */
  protected readonly recurringCalendarAnchor = signal(this.fromLocalIsoDate(this.recurringStartDate()));
  protected readonly recurringDatePickerOpen = signal(false);

  /** Formular custom: întotdeauna o săptămână întreagă vizibilă pe grilă, cu navigare săptămână-cu-săptămână. */
  protected readonly customDate = signal(this.toLocalIsoDate(new Date()));
  /** Selecția curentă din grilă -- fie intervale noi (id sintetic, generat de calendar-board), fie ferestre deja
   * salvate aduse aici printr-un click (id-ul e chiar id-ul blocului) ca să poată fi mutate. Ambele tipuri
   * coexistă liber, ca userul să poată muta o fereastră existentă ȘI adăuga alta nouă în același timp. */
  protected readonly drafts = signal<CalendarBoardInterval[]>([]);
  /** Câte săptămâni suplimentare copiază `repeatCustomWeek()` -- aplică tiparul săptămânii curente mai departe. */
  protected readonly repeatWeeks = signal(4);

  /** Luna afișată în mini-calendarul de selecție a datei -- separată de `customDate` (vezi dashboard-calendar-page
   * pentru aceeași idee): răsfoirea lunilor nu trebuie să mute și săptămâna afișată în grilă. */
  protected readonly customCalendarAnchor = signal(this.fromLocalIsoDate(this.customDate()));
  protected readonly customDatePickerOpen = signal(false);

  /** Intervalul orar vizibil pe grilă -- ajustabil de utilizator, implicit 08:00-20:00. */
  protected readonly visibleStartHour = signal(8);
  protected readonly visibleEndHour = signal(20);

  protected readonly customWeekDays = computed<CalendarBoardDay[]>(() => {
    this.activeLang();
    return this.buildWeekDays(this.customDate());
  });
  protected readonly customMonthCells = computed<MiniCalendarDay[]>(() => this.buildMonthCells(this.customCalendarAnchor()));
  protected readonly customMonthLabel = computed(() =>
    new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { month: 'long', year: 'numeric' }).format(this.customCalendarAnchor())
  );

  protected readonly recurringMonthCells = computed<MiniCalendarDay[]>(() => this.buildMonthCells(this.recurringCalendarAnchor()));
  protected readonly recurringMonthLabel = computed(() =>
    new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { month: 'long', year: 'numeric' }).format(this.recurringCalendarAnchor())
  );

  /** Ferestrele existente aflate curent în `drafts` (aduse acolo printr-un click, ca să fie mutate) nu se mai
   * randează și pe track-ul read-only -- altfel ar apărea de două ori (o dată ca bloc salvat, o dată ca draft). */
  protected readonly tracks = computed<CalendarBoardTrack[]>(() => {
    const draftIds = new Set(this.drafts().map((draft) => draft.id));
    const events = this.availability()
      .filter((block) => !draftIds.has(block.id))
      .map((block) => this.toBoardEvent(block));
    return [{ id: 'availability', color: '', interactive: true, kind: 'availability', events }];
  });

  constructor() {
    effect(() => {
      const resourceId = this.resourceId();
      this.clearDrafts();
      this.loadAvailability(resourceId);
    });

    // Resincronizează mini-calendarul cu săptămâna efectiv afișată -- dar navigarea prin luni a mini-calendarului
    // (shiftCustomCalendarMonth) nu atinge `customDate`, deci nu se re-declanșează la simpla răsfoire.
    effect(() => {
      this.customCalendarAnchor.set(this.fromLocalIsoDate(this.customDate()));
    });

    effect(() => {
      this.recurringCalendarAnchor.set(this.fromLocalIsoDate(this.recurringStartDate()));
    });
  }

  protected toggleWeekday(day: number): void {
    this.recurringWeekdays.update((current) => {
      const next = new Set(current);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  protected isWeekdaySelected(day: number): boolean {
    return this.recurringWeekdays().has(day);
  }

  protected applyRecurring(): void {
    const weekdays = this.recurringWeekdays();
    if (!weekdays.size) {
      this.error.set(this.transloco.translate('dashboard.availability.errors.selectDay'));
      return;
    }
    const start = parseCalendarTime(this.recurringStartTime());
    const end = parseCalendarTime(this.recurringEndTime());
    if (end <= start) {
      this.error.set(this.transloco.translate('dashboard.availability.errors.endAfterStart'));
      return;
    }
    const weeks = Math.max(1, Math.min(52, this.recurringWeeks()));
    const dates = this.datesForWeekdays(this.recurringStartDate(), weeks, weekdays);
    if (!dates.length) {
      this.error.set(this.transloco.translate('dashboard.availability.errors.noMatchingDates'));
      return;
    }

    this.error.set(null);
    this.message.set(null);
    const resourceId = this.resourceId();
    const startTime = this.recurringStartTime();
    const endTime = this.recurringEndTime();

    const addedMessage = dates.length === 1
      ? this.transloco.translate('dashboard.availability.messages.addedDaysOne')
      : this.transloco.translate('dashboard.availability.messages.addedDaysMany', { count: dates.length });

    forkJoin(dates.map((date) => this.api.addResourceAvailability(resourceId, date, startTime, endTime))).subscribe({
      next: () => this.loadAvailability(resourceId, addedMessage),
      error: () => this.error.set(this.transloco.translate('dashboard.availability.errors.saveRecurringFailed'))
    });
  }

  protected setMode(mode: AvailabilityPanelMode): void {
    this.mode.set(mode);
    this.clearDrafts();
  }

  /** Navighează cu o săptămână întreagă înainte/înapoi. */
  protected shiftCustomWeek(direction: -1 | 1): void {
    const next = this.fromLocalIsoDate(this.customDate());
    next.setDate(next.getDate() + direction * 7);
    this.setCustomDate(this.toLocalIsoDate(next));
  }

  protected setCustomDate(iso: string): void {
    this.customDate.set(iso);
    this.clearDrafts();
  }

  /** Alege o zi din mini-calendar: mută săptămâna grilei acolo și închide dropdown-ul. */
  protected onCustomDatePicked(isoDate: string): void {
    this.setCustomDate(isoDate);
    this.customDatePickerOpen.set(false);
  }

  /** Doar navighează luna afișată în mini-calendar -- NU mută și săptămâna din grilă (vezi comentariul de la
   * `customCalendarAnchor`). */
  protected shiftCustomCalendarMonth(offset: number): void {
    const next = new Date(this.customCalendarAnchor());
    next.setMonth(next.getMonth() + offset, 1);
    this.customCalendarAnchor.set(next);
  }

  protected setRecurringStartMinutes(minutes: number | null): void {
    if (minutes === null) {
      return;
    }
    this.recurringStartTime.set(formatCalendarMinutes(minutes));
  }

  protected setRecurringEndMinutes(minutes: number | null): void {
    if (minutes === null) {
      return;
    }
    this.recurringEndTime.set(formatCalendarMinutes(minutes));
  }

  protected onRecurringDatePicked(isoDate: string): void {
    this.recurringStartDate.set(isoDate);
    this.recurringDatePickerOpen.set(false);
  }

  protected shiftRecurringCalendarMonth(offset: number): void {
    const next = new Date(this.recurringCalendarAnchor());
    next.setMonth(next.getMonth() + offset, 1);
    this.recurringCalendarAnchor.set(next);
  }

  protected setVisibleStartHour(hour: number): void {
    if (hour < this.visibleEndHour()) {
      this.visibleStartHour.set(hour);
    }
  }

  protected setVisibleEndHour(hour: number): void {
    if (hour > this.visibleStartHour()) {
      this.visibleEndHour.set(hour);
    }
  }

  protected removeDraft(id: string): void {
    this.drafts.set(this.drafts().filter((interval) => interval.id !== id));
  }

  protected clearDrafts(): void {
    this.drafts.set([]);
  }

  protected intervalLabel(interval: CalendarBoardInterval): string {
    return `${formatCalendarMinutes(interval.startMinutes)} – ${formatCalendarMinutes(interval.endMinutes)}`;
  }

  protected intervalDuration(interval: CalendarBoardInterval): string {
    return calendarIntervalDurationLabel(interval);
  }

  /** Salvează toate drafturile curente -- fie ele ferestre noi (creează) sau ferestre existente mutate aici
   * printr-un click (actualizează), amestecate liber în aceeași selecție. */
  protected saveCustomDrafts(): void {
    const drafts = this.drafts();
    if (!drafts.length) {
      return;
    }
    const resourceId = this.resourceId();
    this.error.set(null);
    this.message.set(null);

    const requests = drafts.map((interval) => {
      const startTime = formatCalendarMinutes(interval.startMinutes);
      const endTime = formatCalendarMinutes(interval.endMinutes);
      return this.isExistingBlockDraft(interval.id)
        ? this.api.updateResourceAvailability(resourceId, interval.id, interval.date, startTime, endTime)
        : this.api.addResourceAvailability(resourceId, interval.date, startTime, endTime);
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.drafts.set([]);
        this.loadAvailability(resourceId, this.transloco.translate('dashboard.availability.messages.availabilitySaved'));
      },
      error: (err) => this.error.set(err?.error?.message ?? this.transloco.translate('dashboard.availability.errors.saveFailed'))
    });
  }

  protected isExistingBlockDraft(id: string): boolean {
    return this.availability().some((block) => block.id === id);
  }

  /** Copiază tiparul deja salvat al săptămânii curente (aceleași zile/ore) pe încă N săptămâni de-a rândul. */
  protected repeatCustomWeek(): void {
    const weekIsoDates = new Set(this.customWeekDays().map((day) => day.isoDate));
    const currentWeekBlocks = this.availability().filter((block) => weekIsoDates.has(block.date));

    if (!currentWeekBlocks.length) {
      this.error.set(this.transloco.translate('dashboard.availability.errors.noWeekToRepeat'));
      return;
    }

    const weeks = Math.max(1, Math.min(52, this.repeatWeeks()));
    const resourceId = this.resourceId();
    const weekOffsets = Array.from({ length: weeks }, (_, index) => index + 1);

    const requests = weekOffsets.flatMap((weekOffset) =>
      currentWeekBlocks.map((block) => {
        const targetDate = this.fromLocalIsoDate(block.date);
        targetDate.setDate(targetDate.getDate() + weekOffset * 7);
        return this.api.addResourceAvailability(resourceId, this.toLocalIsoDate(targetDate), block.startTime, block.endTime);
      })
    );

    this.error.set(null);
    this.message.set(null);

    const repeatedMessage = weeks === 1
      ? this.transloco.translate('dashboard.availability.messages.repeatedWeeksOne')
      : this.transloco.translate('dashboard.availability.messages.repeatedWeeksMany', { count: weeks });

    forkJoin(requests).subscribe({
      next: () => this.loadAvailability(resourceId, repeatedMessage),
      error: () => this.error.set(this.transloco.translate('dashboard.availability.errors.repeatFailed'))
    });
  }

  /** Click pe o fereastră deja salvată: o adaugă la selecția curentă (dacă nu e deja acolo), ca să poată fi
   * mutată/redimensionată -- fără să înlocuiască restul selecției, ca userul să poată muta ferestre existente
   * ȘI adăuga altele noi, toate deodată. */
  protected onEventClicked(event: { trackId: string; event: CalendarBoardInterval }): void {
    const block = this.availability().find((item) => item.id === event.event.id);
    if (!block || this.drafts().some((draft) => draft.id === block.id)) {
      return;
    }
    this.drafts.set([...this.drafts(), this.toBoardEvent(block)]);
  }

  /** Șterge definitiv o fereastră existentă (nu doar din selecția curentă, ci și de pe server). */
  protected deleteBlock(block: AvailabilityBlock): void {
    const resourceId = this.resourceId();
    this.api.removeResourceAvailability(resourceId, block.id).subscribe({
      next: () => {
        this.removeDraft(block.id);
        this.loadAvailability(resourceId, this.transloco.translate('dashboard.availability.messages.availabilityRemoved'));
      },
      error: () => this.error.set(this.transloco.translate('dashboard.availability.errors.removeFailed'))
    });
  }

  /** Șterge definitiv fereastra existentă aflată în spatele draft-ului cu acest id (nu-l are efect pe drafturile
   * noi, care încă nu există pe server). */
  protected deleteDraftBlock(id: string): void {
    const block = this.availability().find((item) => item.id === id);
    if (!block) {
      return;
    }
    this.deleteBlock(block);
  }

  private datesForWeekdays(startIso: string, weeks: number, weekdays: Set<number>): string[] {
    const start = this.fromLocalIsoDate(startIso);
    const totalDays = weeks * 7;
    const dates: string[] = [];
    for (let index = 0; index < totalDays; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      if (weekdays.has(date.getDay())) {
        dates.push(this.toLocalIsoDate(date));
      }
    }
    return dates;
  }

  private toBoardEvent(block: AvailabilityBlock): CalendarBoardInterval {
    return {
      id: block.id,
      date: block.date,
      startMinutes: parseCalendarTime(block.startTime),
      endMinutes: parseCalendarTime(block.endTime)
    };
  }

  private buildDay(isoDate: string): CalendarBoardDay {
    const date = this.fromLocalIsoDate(isoDate);
    const todayIso = this.toLocalIsoDate(new Date());
    return {
      date,
      isoDate,
      label: new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { weekday: 'short' }).format(date),
      dayNumber: date.getDate(),
      isToday: isoDate === todayIso,
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    };
  }

  /** Săptămâna (luni-duminică) care conține data dată, ca cele 7 zile ale grilei în modul Week. */
  private buildWeekDays(anchorIsoDate: string): CalendarBoardDay[] {
    const anchor = this.fromLocalIsoDate(anchorIsoDate);
    const dayOfWeek = anchor.getDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return this.buildDay(this.toLocalIsoDate(date));
    });
  }

  /** Grila lunară (luni-start, 6 săptămâni) pentru mini-calendarul de selecție a datei. */
  private buildMonthCells(anchorDate: Date): MiniCalendarDay[] {
    const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const month = firstOfMonth.getMonth();
    const startDay = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - startDay);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        isoDate: this.toLocalIsoDate(date),
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month
      };
    });
  }

  private loadAvailability(resourceId: string, successMessage: string | null = null): void {
    this.api
      .getResourceAvailability(resourceId)
      .pipe(catchError(() => of([] as ResourceAvailabilityResponseItem[])))
      .subscribe((response) => {
        this.availability.set(this.normalizeAvailabilityResponse(response));
        if (successMessage) {
          this.message.set(successMessage);
          this.error.set(null);
        }
      });
  }

  private normalizeAvailabilityResponse(response: unknown): AvailabilityBlock[] {
    const items = Array.isArray(response) ? response : this.extractAvailabilityItems(response);
    return items.map((item) => this.normalizeAvailabilityItem(item)).filter((item): item is AvailabilityBlock => item !== null);
  }

  private extractAvailabilityItems(response: unknown): ResourceAvailabilityResponseItem[] {
    if (!response || typeof response !== 'object') {
      return [];
    }
    const maybeItems = (response as { items?: unknown }).items;
    return Array.isArray(maybeItems) ? (maybeItems as ResourceAvailabilityResponseItem[]) : [];
  }

  private normalizeAvailabilityItem(item: unknown): AvailabilityBlock | null {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const candidate = item as Partial<ResourceAvailabilityResponseItem>;
    if (!candidate.id || !candidate.date || !candidate.startTime || !candidate.endTime) {
      return null;
    }
    return { id: candidate.id, date: candidate.date, startTime: candidate.startTime, endTime: candidate.endTime };
  }

  private toLocalIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private fromLocalIsoDate(isoDate: string): Date {
    const [year, month, day] = isoDate.split('-').map((value) => Number(value));
    return new Date(year, month - 1, day);
  }
}
