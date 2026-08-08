import { Component, computed, effect, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CalendarBoardDay,
  CalendarBoardInterval,
  CalendarBoardTrack,
  formatCalendarMinutes
} from './calendar-board.utils';

interface CalendarBoardDragState {
  kind: 'resize' | 'move';
  edge?: 'start' | 'end';
  id: string;
  startClientY: number;
  initialStart: number;
  initialEnd: number;
}

@Component({
  selector: 'app-calendar-board',
  imports: [TranslocoPipe],
  templateUrl: './calendar-board.html',
  styleUrl: './calendar-board.scss'
})
export class CalendarBoardComponent {
  readonly headerDays = input.required<CalendarBoardDay[]>();
  readonly columnDays = input.required<CalendarBoardDay[]>();
  readonly singleColumn = input(false);
  readonly focusedIsoDate = input<string | null>(null);

  readonly startHour = input(8);
  readonly endHour = input(20);
  readonly slotMinutes = input(30);
  readonly hourHeightPx = input(56);
  readonly minDurationMinutes = input(5);
  /** Durata unui interval NOU creat printr-un simplu click pe un slot (nu drag) -- implicit `slotMinutes`, dar
   * un consumator poate trimite o valoare dinamică (ex. durata serviciului ales) ca noul interval să pornească
   * deja la lungimea potrivită, fără să mai fie nevoie de redimensionare manuală după. Null/nesetat => `slotMinutes`. */
  readonly clickDurationMinutes = input<number | null>(null);
  /** Când e false, grila nu-și mai scrollează propriul conținut (nici nu blochează scroll-ul paginii la
   * marginile ei) -- randează la înălțimea naturală și lasă un ancestor mai sus (pagina/panoul) să scrolleze.
   * Implicit true, pentru board-ul cu înălțime fixă din dashboard-ul de calendar. */
  readonly internalScroll = input(true);

  readonly tracks = input<CalendarBoardTrack[]>([]);
  readonly drafts = input<CalendarBoardInterval[]>([]);
  readonly disabled = input(false);
  /** When true, a new slot click replaces the whole drafts array instead of merging into it (one interval at a time). */
  readonly singleInterval = input(false);
  /** When false, overlapping/touching drafts stay as separate intervals instead of being merged into one (e.g. so
   * two back-to-back manual bookings, each with its own client, don't collapse into a single draft). */
  readonly mergeDrafts = input(true);
  /** Styling hint for the current drafts — which color palette to draw them in. */
  readonly draftVariant = input<'availability' | 'appointment'>('availability');

  readonly draftsChange = output<CalendarBoardInterval[]>();
  readonly eventClicked = output<{ trackId: string; event: CalendarBoardInterval; clientX: number; clientY: number }>();
  readonly daySelected = output<string>();

  /** Copie locală a drafts-urilor, sincronizată din input; sursa de adevăr rămâne la consumator. */
  protected readonly draftsState = signal<CalendarBoardInterval[]>([]);
  private readonly dragState = signal<CalendarBoardDragState | null>(null);
  private draftIdCounter = 0;

  protected readonly slots = computed(() => {
    const start = this.startHour();
    const end = this.endHour();
    const step = this.slotMinutes();
    return Array.from({ length: ((end - start) * 60) / step }, (_, index) => start * 60 + index * step);
  });

  /** Folosit doar pentru detectarea coliziunilor la drag (occupiedRangesForDate) -- e mereu track-ul unic al
   * resursei selectate, celelalte resurse vizibile nu blochează reciproc sloturile (fiecare e independentă). */
  protected readonly interactiveTracks = computed(() => this.tracks().filter((track) => track.interactive));

  /**
   * Track-urile de tip 'appointment' (rezervări) împart lățimea zilei în coloane EGALE, una per resursă vizibilă
   * -- colorate distinct pe resursă, indiferent dacă sunt cea selectată (interactivă) sau doar afișată pentru
   * comparație. Track-urile de tip 'availability' rămân pe layout-ul vechi, pe toată lățimea (folosit doar de
   * panoul de disponibilitate, unde există mereu un singur astfel de track).
   */
  protected readonly laneTracks = computed(() => this.tracks().filter((track) => track.kind === 'appointment'));
  protected readonly nonLaneTracks = computed(() => this.tracks().filter((track) => track.kind !== 'appointment'));

  /** Coloana (lane) în care apare draft-ul curent -- cea a resursei interactive/selectate, dacă există una. */
  protected readonly draftLaneIndex = computed(() => {
    const lanes = this.laneTracks();
    if (!lanes.length) {
      return 0;
    }
    const index = lanes.findIndex((track) => track.interactive);
    return index >= 0 ? index : 0;
  });

  /** Culoarea resursei căreia îi aparține draft-ul curent (aceeași nuanță ca programările deja salvate ale ei) --
   * randată mai transparentă în șablon, ca draft-ul să rămână recognoscibil ca "încă nesalvat". */
  protected readonly draftColor = computed(() => this.laneTracks()[this.draftLaneIndex()]?.color ?? null);

  constructor() {
    effect(() => {
      this.draftsState.set(this.drafts());
    });
  }

  protected formatMinutes(minutes: number): string {
    return formatCalendarMinutes(minutes);
  }

  protected isFullHour(slotStart: number): boolean {
    return slotStart % 60 === 0;
  }

  protected onDayHeadClick(isoDate: string): void {
    this.daySelected.emit(isoDate);
  }

  /** Click pe un slot: pornește un interval nou sau îl extinde pe cel existent care se suprapune. */
  protected selectSlot(dateIso: string | null, slotStart: number): void {
    if (this.disabled() || !dateIso) {
      return;
    }

    // Clampat la marginea de jos a zilei -- un clickDurationMinutes mai mare decât grila (ex. un serviciu lung
    // aproape de ora de închidere) nu trebuie să creeze un interval care iese din ziua vizibilă.
    const duration = this.clickDurationMinutes() ?? this.slotMinutes();
    const slotEnd = Math.min(slotStart + duration, this.endHour() * 60);

    // Fără merge (ex. rezervări): un slot deja ocupat de alt draft sau de o programare existentă nu poate
    // porni o selecție separată care s-ar suprapune peste el -- click-ul e pur și simplu ignorat.
    if (!this.canPlace(dateIso, slotStart, slotEnd, null)) {
      return;
    }

    const next: CalendarBoardInterval = {
      id: this.nextDraftId(),
      date: dateIso,
      startMinutes: slotStart,
      endMinutes: slotEnd
    };
    const base = this.singleInterval() ? [] : this.draftsState();
    this.emitDrafts(this.mergeIfEnabled([...base, next]));
  }

  protected isSlotSelected(dateIso: string, slotStart: number): boolean {
    const slotEnd = slotStart + this.slotMinutes();
    return this.draftsState().some(
      (interval) => interval.date === dateIso && slotEnd > interval.startMinutes && slotStart < interval.endMinutes
    );
  }

  protected draftsForDate(dayIsoDate: string): CalendarBoardInterval[] {
    return this.draftsState().filter((interval) => interval.date === dayIsoDate);
  }

  protected eventsForDate(track: CalendarBoardTrack, dayIsoDate: string): CalendarBoardInterval[] {
    return track.events.filter((event) => event.date === dayIsoDate);
  }

  protected eventStyle(interval: Pick<CalendarBoardInterval, 'startMinutes' | 'endMinutes'>): { top: string; height: string } {
    return {
      top: `${this.minutesToPx(interval.startMinutes)}px`,
      height: `${((interval.endMinutes - interval.startMinutes) / 60) * this.hourHeightPx()}px`
    };
  }

  /** Poziția/lățimea unei coloane (lane) egale din N, cu un mic gutter între coloane vecine. */
  protected laneStyle(index: number, count: number): { left: string; width: string } {
    const safeCount = Math.max(1, count);
    const widthPct = 100 / safeCount;
    const leftPct = index * widthPct;
    const gap = 4;
    return {
      left: `calc(${leftPct}% + ${gap}px)`,
      width: `calc(${widthPct}% - ${gap * 2}px)`
    };
  }

  protected onEventClick(track: CalendarBoardTrack, event: CalendarBoardInterval, pointerEvent: MouseEvent): void {
    this.eventClicked.emit({ trackId: track.id, event, clientX: pointerEvent.clientX, clientY: pointerEvent.clientY });
  }

  /** Pornește drag-ul pe un handle de start/end al unei selecții (resize). */
  protected startResize(event: PointerEvent, interval: CalendarBoardInterval, edge: 'start' | 'end'): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    this.dragState.set({
      kind: 'resize',
      edge,
      id: interval.id,
      startClientY: event.clientY,
      initialStart: interval.startMinutes,
      initialEnd: interval.endMinutes
    });
  }

  /** Pornește drag-ul pe corpul unei selecții (mutare, păstrează durata). */
  protected startMove(event: PointerEvent, interval: CalendarBoardInterval): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const block = event.currentTarget as HTMLElement;
    block.setPointerCapture(event.pointerId);
    this.dragState.set({
      kind: 'move',
      id: interval.id,
      startClientY: event.clientY,
      initialStart: interval.startMinutes,
      initialEnd: interval.endMinutes
    });
  }

  /**
   * În timpul drag-ului: recalculează selecția urmărită, snap la minDurationMinutes, clamp la limitele zilei.
   * Fără merge (ex. rezervări), fiecare poziție candidată e verificată împotriva altor drafturi/programări --
   * dacă s-ar suprapune, mutarea/redimensionarea de la acest tick e pur și simplu ignorată (rămâne la ultima
   * poziție validă) și se reia de îndată ce cursorul ajunge într-un loc liber. Verificarea e per-tick, nu o
   * limită fixă calculată la începutul drag-ului -- altfel blocul n-ar putea trece NICIODATĂ peste alt bloc
   * ca să ajungă într-un spațiu liber mai departe, chiar dacă acolo chiar e loc.
   */
  protected onDragMove(event: PointerEvent): void {
    const state = this.dragState();
    if (!state) {
      return;
    }
    const interval = this.draftsState().find((item) => item.id === state.id);
    if (!interval) {
      return;
    }
    event.preventDefault();

    const deltaMinutesRaw = ((event.clientY - state.startClientY) / this.hourHeightPx()) * 60;
    const step = this.minDurationMinutes();
    const deltaMinutes = Math.round(deltaMinutesRaw / step) * step;
    const dayLower = this.startHour() * 60;
    const dayUpper = this.endHour() * 60;

    if (state.kind === 'resize') {
      if (state.edge === 'start') {
        const upper = interval.endMinutes - step;
        const start = Math.max(dayLower, Math.min(state.initialStart + deltaMinutes, upper));
        if (start !== interval.startMinutes && this.canPlace(interval.date, start, interval.endMinutes, state.id)) {
          this.updateDraft(state.id, { startMinutes: start });
        }
      } else {
        const lower = interval.startMinutes + step;
        const end = Math.min(dayUpper, Math.max(state.initialEnd + deltaMinutes, lower));
        if (end !== interval.endMinutes && this.canPlace(interval.date, interval.startMinutes, end, state.id)) {
          this.updateDraft(state.id, { endMinutes: end });
        }
      }
    } else {
      const duration = state.initialEnd - state.initialStart;
      const lower = dayLower;
      const upper = dayUpper - duration;
      const start = Math.max(lower, Math.min(state.initialStart + deltaMinutes, upper));
      const end = start + duration;
      if ((start !== interval.startMinutes || end !== interval.endMinutes) && this.canPlace(interval.date, start, end, state.id)) {
        this.updateDraft(state.id, { startMinutes: start, endMinutes: end });
      }
    }
  }

  /** Încheie drag-ul curent și unește orice intervale care se suprapun în urma lui. */
  protected endDrag(event: PointerEvent): void {
    if (!this.dragState()) {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    this.emitDrafts(this.mergeIfEnabled(this.draftsState()));
    this.dragState.set(null);
  }

  private updateDraft(id: string, patch: Partial<Pick<CalendarBoardInterval, 'startMinutes' | 'endMinutes'>>): void {
    this.emitDrafts(this.draftsState().map((interval) => (interval.id === id ? { ...interval, ...patch } : interval)));
  }

  private emitDrafts(next: CalendarBoardInterval[]): void {
    this.draftsState.set(next);
    this.draftsChange.emit(next);
  }

  private nextDraftId(): string {
    this.draftIdCounter += 1;
    return `board-draft-${this.draftIdCounter}`;
  }

  /** True dacă intervalul poate fi plasat acolo -- mereu true când mergeDrafts e activ (suprapunerea se unește
   * la final), altfel doar dacă [start, end) e complet liber. */
  private canPlace(dateIso: string, start: number, end: number, excludeDraftId: string | null): boolean {
    return this.mergeDrafts() || !this.isRangeOccupied(dateIso, start, end, excludeDraftId);
  }

  /** True dacă [start, end) se suprapune cu alt draft sau cu o programare existentă, în aceeași zi. */
  private isRangeOccupied(dateIso: string, start: number, end: number, excludeDraftId: string | null): boolean {
    return this.occupiedRangesForDate(dateIso, excludeDraftId).some(
      (range) => start < range.end && end > range.start
    );
  }

  /** Toate intervalele "ocupate" într-o zi -- alte drafturi + evenimentele track-urilor interactive -- cu
   * excepția draft-ului/id-ului dat (cel aflat efectiv în mișcare/creare, ca să nu se blocheze pe el însuși). */
  private occupiedRangesForDate(
    dateIso: string,
    excludeDraftId: string | null
  ): { start: number; end: number }[] {
    const ranges: { start: number; end: number }[] = [];

    for (const draft of this.draftsState()) {
      if (draft.date === dateIso && draft.id !== excludeDraftId) {
        ranges.push({ start: draft.startMinutes, end: draft.endMinutes });
      }
    }

    for (const track of this.interactiveTracks()) {
      for (const event of track.events) {
        if (event.date === dateIso) {
          ranges.push({ start: event.startMinutes, end: event.endMinutes });
        }
      }
    }

    return ranges;
  }

  private minutesToPx(minutes: number): number {
    return ((minutes - this.startHour() * 60) / 60) * this.hourHeightPx();
  }

  private mergeIfEnabled(drafts: CalendarBoardInterval[]): CalendarBoardInterval[] {
    return this.mergeDrafts() ? this.mergeOverlappingDrafts(drafts) : drafts;
  }

  /** Unește intervalele care se suprapun sau se ating, per dată, într-un singur interval. */
  private mergeOverlappingDrafts(drafts: CalendarBoardInterval[]): CalendarBoardInterval[] {
    const byDate = new Map<string, CalendarBoardInterval[]>();
    for (const interval of drafts) {
      const list = byDate.get(interval.date) ?? [];
      list.push(interval);
      byDate.set(interval.date, list);
    }

    const merged: CalendarBoardInterval[] = [];
    for (const intervals of byDate.values()) {
      const sorted = [...intervals].sort((a, b) => a.startMinutes - b.startMinutes);
      let current: CalendarBoardInterval | null = null;

      for (const interval of sorted) {
        if (!current) {
          current = interval;
          continue;
        }
        if (interval.startMinutes <= current.endMinutes) {
          current = { ...current, endMinutes: Math.max(current.endMinutes, interval.endMinutes) };
        } else {
          merged.push(current);
          current = interval;
        }
      }

      if (current) {
        merged.push(current);
      }
    }

    return merged;
  }
}
