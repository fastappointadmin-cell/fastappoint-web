import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, from, of } from 'rxjs';
import { catchError, concatMap, toArray } from 'rxjs/operators';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardApiService } from '../../data-access/dashboard-api.service';
import { DashboardFacade } from '../../data-access/dashboard-facade';
import { FixedSlotsListComponent } from '../../components/fixed-slots-list/fixed-slots-list';
import { CalendarBoardComponent } from '../../components/calendar-board/calendar-board';
import { MiniCalendarComponent } from '../../components/mini-calendar/mini-calendar';
import { HourPickerComponent } from '../../components/hour-picker/hour-picker';
import { TimePickerComponent } from '../../components/time-picker/time-picker';
import { CustomerFieldsComponent, CustomerCandidate } from '../../components/customer-fields/customer-fields';
import {
  CalendarBoardDay,
  CalendarBoardInterval,
  CalendarBoardTrack,
  calendarIntervalDurationLabel,
  formatCalendarMinutes,
  parseCalendarTime
} from '../../components/calendar-board/calendar-board.utils';
import { DashboardAppointment, DashboardCreateAppointmentRequest } from '../../models/dashboard-appointment.model';
import { ToastService } from '../../../../shared/toast/toast.service';

interface BookingCapacityInputDefinition {
  key: string;
  resourceTypeName: string;
}


type CalendarViewMode = 'day' | 'week' | 'month' | 'year';
/** Colțul de jos în care stă panoul de editare -- ales o singură dată, la intrarea în editare, opus click-ului pe orizontală. */
type ScreenCorner = 'bottom-left' | 'bottom-right';

interface CalendarDay extends CalendarBoardDay {
  isCurrentMonth: boolean;
}

interface CalendarMonthCell {
  date: Date;
  isoDate: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  appointmentCount: number;
}

interface CalendarYearMonth {
  monthIndex: number;
  label: string;
  weeks: CalendarMonthCell[][];
}

/** Ce se editează în acest moment (click pe o programare existentă a resursei selectate, apoi drag). */
interface EditingItem {
  id: string;
  resourceId: string;
}

/** Datele de client pentru O SINGURĂ rezervare manuală -- fiecare interval tras pe grilă are propriul client. */
interface ManualBookingDetails {
  customerName: string;
  customerPhone: string;
  manualLabel: string;
}

const EMPTY_MANUAL_BOOKING_DETAILS: ManualBookingDetails = { customerName: '', customerPhone: '', manualLabel: '' };
const INTL_LOCALES: Record<string, string> = { en: 'en-US', ro: 'ro-RO' };

@Component({
  selector: 'app-dashboard-calendar-page',
  imports: [
    FormsModule,
    FixedSlotsListComponent,
    CalendarBoardComponent,
    MiniCalendarComponent,
    HourPickerComponent,
    TimePickerComponent,
    CustomerFieldsComponent,
    TranslocoPipe
  ],
  templateUrl: './dashboard-calendar-page.html',
  styleUrl: './dashboard-calendar-page.scss',
  host: {
    '(window:resize)': 'onWindowResize()'
  }
})
export class DashboardCalendarPage {
  private readonly facade = inject(DashboardFacade);
  private readonly api = inject(DashboardApiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });
  private readonly mobileViewportWidth = 768;
  protected readonly parseCalendarTime = parseCalendarTime;

  /** Pe mobil, Week nu încape uzabil (7 coloane înguste) -- tab-ul e ascuns și modul comută la Day. */
  protected readonly isMobileViewport = signal(this.readIsMobileViewport());

  /** Intervalul orar vizibil pe grilă -- ajustabil de utilizator, implicit 08:00-20:00. */
  protected readonly visibleStartHour = signal(8);
  protected readonly visibleEndHour = signal(20);

  protected readonly viewMode = signal<CalendarViewMode>('day');
  protected readonly selectedDate = signal(this.startOfToday());
  protected readonly selectedResourceId = signal<string | null>(null);
  protected readonly visibleResourceIds = signal<Set<string>>(new Set());
  protected readonly appointmentsByResource = signal<Map<string, DashboardAppointment[]>>(new Map());
  protected readonly availabilityMessage = signal<string | null>(null);
  protected readonly availabilityError = signal<string | null>(null);

  /** Formular unificat de rezervare: serviciu opțional + resursă opțională (preferată), fără tab-uri. */
  protected readonly bookingServiceId = signal<string | null>(null);
  protected readonly bookingCustomerName = signal('');
  protected readonly bookingCustomerPhone = signal('');
  protected readonly bookingInputs = signal<Record<string, number | null>>({});

  /**
   * Resursa "preferată" din formularul de rezervare -- SEPARATĂ de `selectedResourceId` (care trebuie mereu să
   * aibă o valoare, pentru grilă/sidebar) tocmai ca să poți reveni la "fără preferință" fără ca efectul de mai
   * jos (care ține `selectedResourceId` mereu populat) să o repopuleze imediat cu prima resursă din listă.
   * Alegerea unei resurse aici sincronizează și `selectedResourceId` (ca să poți trage un interval pe grila ei),
   * dar revenirea la "fără preferință" NU atinge `selectedResourceId`.
   */
  protected readonly bookingPreferredResourceId = signal<string | null>(null);

  /**
   * "Prima disponibilitate": doar când e ales un serviciu și nu s-a tras niciun interval pe grilă. `rawAvailableStarts`
   * vine direct de la backend (deja filtrat după disponibilitatea resurselor); `suggestedStarts` aplică local
   * preferința de oră, dacă există una, fără să refacă cererea la fiecare tastă apăsată în câmpul de oră preferată.
   */
  private readonly rawAvailableStarts = signal<string[]>([]);
  protected readonly preferredTime = signal<string | null>(null);
  protected readonly selectedStart = signal<string | null>(null);

  /**
   * Rezervare directă pe resursă: poți trage MAI MULTE intervale deodată, fiecare devine o rezervare separată
   * cu propriul client -- datele sunt ținute per-draft (cheie = id-ul draft-ului), nu într-un formular comun.
   */
  protected readonly manualBookingDetails = signal<Map<string, ManualBookingDetails>>(new Map());

  /** Programarea selectată pentru vizualizare/acțiuni (click pe un bloc/chip de rezervare) — afișată exact la punctul de click. */
  protected readonly selectedAppointment = signal<DashboardAppointment | null>(null);

  /** Editare in-place (drag) a unei programări existente, deținute de resursa selectată. */
  protected readonly editingItem = signal<EditingItem | null>(null);
  protected readonly editingDate = signal('');
  protected readonly editingDatePickerOpen = signal(false);
  /** Ziua afișată în grilă chiar înainte de a intra în editare -- restaurată la Cancel (vezi `cancelEditing`). */
  private editEntryDate: Date | null = null;

  /** Punctul unde s-a dat click pe programare -- popover-ul de vizualizare apare chiar acolo (clamp-uit la fereastră). */
  private readonly clickPoint = signal<{ x: number; y: number } | null>(null);
  /** Colțul în care sare panoul de editare -- opus click-ului, ca blocul editat să rămână liber pentru drag. */
  protected readonly editPanelCorner = signal<ScreenCorner>('bottom-right');

  /** Căutare rezervări după client (nume/telefon), pe toată afacerea. */
  protected readonly clientSearchQuery = signal('');
  private readonly businessAppointments = signal<DashboardAppointment[]>([]);
  private businessAppointmentsRequested = false;

  /** Selecțiile curente (intervale multiple, în minute de la miezul nopții), pasate la board ca [drafts]. */
  protected readonly drafts = signal<CalendarBoardInterval[]>([]);

  /**
   * Luna afișată în mini-calendare (cel din sidebar și cel din panoul de editare) -- separată de `selectedDate`.
   * Doar navigarea explicită a unei zile (selectDate/pickEditingDate/etc.) mută `selectedDate` și, prin efectul
   * de mai jos, resincronizează acest anchor; simpla răsfoire cu "lună anterioară/următoare" (shiftMonth) NU
   * trebuie să mute și grila principală (ziua editată/vizualizată), altfel o programare aflată în editare
   * "dispare" din vizor doar pentru că ai răsfoit lunile în selectorul de dată.
   */
  protected readonly miniCalendarAnchor = signal(this.startOfToday());

  protected readonly selectedDateIso = computed(() => this.toLocalIsoDate(this.selectedDate()));

  protected readonly business = computed(() => this.facade.selectedBusiness());
  protected readonly resources = computed(() => this.business()?.resources ?? []);
  protected readonly services = computed(() => this.facade.services());
  protected readonly selectedBookingService = computed(
    () => this.services().find((item) => item.id === this.bookingServiceId()) ?? null
  );
  protected readonly bookingCapacityInputs = computed<BookingCapacityInputDefinition[]>(() => {
    const service = this.selectedBookingService();
    if (!service) {
      return [];
    }

    const inputs = new Map<string, BookingCapacityInputDefinition>();
    for (const requirement of service.requirements) {
      if (requirement.fulfillmentMode !== 'CAPACITY' || !requirement.capacityInputKey) {
        continue;
      }
      if (!inputs.has(requirement.capacityInputKey)) {
        inputs.set(requirement.capacityInputKey, {
          key: requirement.capacityInputKey,
          resourceTypeName: requirement.resourceTypeName
        });
      }
    }
    return Array.from(inputs.values());
  });
  protected readonly bookingCapacityInputsReady = computed(() =>
    this.bookingCapacityInputs().every((input) => {
      const value = this.bookingInputs()[input.key];
      return typeof value === 'number' && Number.isFinite(value) && value >= 1;
    })
  );
  protected readonly selectedResource = computed(
    () => this.resources().find((resource) => resource.id === this.selectedResourceId()) ?? null
  );

  /** Resursele afișate în dropdown-ul formularului de rezervare: toate, dacă niciun serviciu nu e ales, sau doar
   * cele al căror tip apare într-o cerință a serviciului ales. */
  protected readonly eligibleResources = computed(() => {
    const service = this.selectedBookingService();
    if (!service) {
      return this.resources();
    }
    const eligibleTypeIds = new Set(service.requirements.map((requirement) => requirement.resourceTypeId));
    return this.resources().filter((resource) => eligibleTypeIds.has(resource.typeId));
  });

  /** Durata (minute) unui interval creat prin simplu click pe grilă -- durata serviciului ales, dacă există și e
   * validă, altfel implicitul grilei (30 min, vezi `clickDurationMinutes` pe calendar-board). */
  protected readonly bookingClickDurationMinutes = computed<number | null>(() => {
    const service = this.selectedBookingService();
    if (!service || !service.durationSeconds) {
      return null;
    }
    return Math.round(service.durationSeconds / 60);
  });

  /** Sugestiile de "prima disponibilitate" afișate ca chips -- primele câteva, cu preferința de oră aplicată local. */
  protected readonly suggestedStarts = computed(() => {
    const raw = this.rawAvailableStarts();
    const preferred = this.preferredTime();
    if (!raw.length || !preferred) {
      return raw.slice(0, 6);
    }
    const preferredIso = this.toIsoDateTime(this.selectedDateIso(), parseCalendarTime(preferred));
    const later = raw.filter((start) => start >= preferredIso);
    return (later.length ? later : raw).slice(0, 6);
  });

  protected readonly weekDays = computed(() => this.buildWeekDays(this.selectedDate()));

  protected readonly displayDays = computed<CalendarDay[]>(() => {
    if (this.viewMode() === 'day') {
      const iso = this.selectedDateIso();
      return this.weekDays().filter((day) => day.isoDate === iso);
    }
    return this.weekDays();
  });

  protected readonly miniMonthCells = computed(() => this.buildMonthCells(this.miniCalendarAnchor(), true));
  protected readonly monthCells = computed(() => this.buildMonthCells(this.selectedDate()));
  protected readonly yearMonths = computed(() => this.buildYearMonths(this.selectedDate().getFullYear()));

  private static readonly YEAR_MINI_WEEKDAY_LABELS: Record<string, string[]> = {
    en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    ro: ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  };
  protected readonly yearMiniWeekdayLabels = computed(() => DashboardCalendarPage.YEAR_MINI_WEEKDAY_LABELS[this.activeLang()]);

  protected readonly currentMonthLabel = computed(() =>
    new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { month: 'long', year: 'numeric' }).format(this.selectedDate())
  );

  /** Eticheta lunii pentru mini-calendare (sidebar + panoul de editare) -- urmărește `miniCalendarAnchor`, nu `selectedDate`. */
  protected readonly miniCalendarMonthLabel = computed(() =>
    new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { month: 'long', year: 'numeric' }).format(this.miniCalendarAnchor())
  );

  protected readonly currentDayLabel = computed(() =>
    new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(this.selectedDate())
  );

  protected readonly currentYearLabel = computed(() => String(this.selectedDate().getFullYear()));

  protected readonly titleLabel = computed(() => {
    switch (this.viewMode()) {
      case 'day':
        return this.currentDayLabel();
      case 'week': {
        const days = this.weekDays();
        return `${this.formatShortDate(days[0].date)} – ${this.formatShortDate(days[6].date)}`;
      }
      case 'month':
        return this.currentMonthLabel();
      case 'year':
        return this.currentYearLabel();
    }
  });

  protected readonly viewSubtitle = computed(() => {
    this.activeLang();
    const resourceName = this.selectedResource()?.name ?? this.transloco.translate('dashboard.calendar.noResourceSelected');
    const drafts = this.drafts();
    const summary =
      drafts.length === 0
        ? this.transloco.translate('dashboard.calendar.noSelection')
        : drafts.length === 1
          ? this.intervalLabel(drafts[0])
          : this.transloco.translate('dashboard.calendar.intervalsSelectedMany', { count: drafts.length });
    return `${resourceName} · ${summary}`;
  });

  /** Poziția (clamp-uită în viewport) a popover-ului de vizualizare, lângă blocul pe care s-a dat click. */
  protected readonly popoverStyle = computed(() => this.clampNearPoint(this.clickPoint()));

  /** True doar dacă programarea deschisă în popover aparține resursei selectate (poate fi editată). */
  protected readonly selectedAppointmentEditable = computed(() => {
    const appointment = this.selectedAppointment();
    const selectedId = this.selectedResourceId();
    if (!appointment || !selectedId) {
      return false;
    }
    return (appointment.allocations ?? []).some((allocation) => allocation.resourceId === selectedId);
  });

  /**
   * DTO-ul nu ține minte pe ce cale a fost creată programarea (solver vs. manual), așa că deducem: fără
   * `serviceName` -> manuală; cu `serviceName` ȘI durata exact cea a serviciului -> programare pe serviciu
   * (solver-ul a ales resursa); cu `serviceName` dar durată diferită -> a fost trasă manual pe grilă, cu un
   * serviciu doar atașat ca referință (durata standard a fost suprascrisă -- vezi submitDraftBookings).
   */
  protected readonly selectedAppointmentKind = computed<'service' | 'manual' | 'manual-service'>(() => {
    const appointment = this.selectedAppointment();
    if (!appointment || !appointment.serviceName) {
      return 'manual';
    }
    const service = this.services().find((item) => item.id === appointment.serviceId);
    if (service && this.appointmentDurationSeconds(appointment) === service.durationSeconds) {
      return 'service';
    }
    return 'manual-service';
  });

  protected readonly clientSearchResults = computed(() => {
    const query = this.clientSearchQuery().trim().toLowerCase();
    if (!query) {
      return [];
    }
    return this.businessAppointments().filter(
      (appointment) =>
        appointment.customerName.toLowerCase().includes(query) || appointment.customerPhone.toLowerCase().includes(query)
    );
  });

  /** Clienți unici (după telefon -- e cheia de deduplicare folosită și de backend, vezi resolveCustomer) deduși
   * din toate programările afacerii, pentru autocomplete-ul câmpurilor de client din formularul de rezervare. */
  protected readonly knownCustomers = computed<CustomerCandidate[]>(() => {
    const seen = new Map<string, CustomerCandidate>();
    for (const appointment of this.businessAppointments()) {
      if (!seen.has(appointment.customerPhone)) {
        seen.set(appointment.customerPhone, { name: appointment.customerName, phone: appointment.customerPhone });
      }
    }
    return Array.from(seen.values());
  });

  /** Track-urile pasate boardului: resursa selectată (interactivă) + resursele "vizibile" (doar citire), toate ca rezervări. */
  protected readonly tracks = computed<CalendarBoardTrack[]>(() => {
    this.activeLang();
    const selectedId = this.selectedResourceId();
    const editing = this.editingItem();
    const apptCache = this.appointmentsByResource();
    const list: CalendarBoardTrack[] = [];

    if (selectedId) {
      const selectedResource = this.resources().find((item) => item.id === selectedId);
      const apptEvents = (apptCache.get(selectedId) ?? [])
        .filter((appt) => !(editing && editing.id === appt.id))
        .map((appt) => this.toAppointmentEvent(appt));
      list.push({
        id: `${selectedId}-appointments`,
        label: selectedResource?.name,
        color: this.resourceTone(selectedId),
        interactive: true,
        kind: 'appointment',
        events: apptEvents
      });
    }

    for (const resourceId of this.visibleResourceIds()) {
      if (resourceId === selectedId) {
        continue;
      }
      const resource = this.resources().find((item) => item.id === resourceId);
      const color = this.resourceTone(resourceId);
      list.push({
        id: `${resourceId}-appointments`,
        label: resource?.name,
        color,
        interactive: false,
        kind: 'appointment',
        events: (apptCache.get(resourceId) ?? []).map((appt) => this.toAppointmentEvent(appt))
      });
    }

    return list;
  });

  /** Board-ul e interactiv oricând e o resursă aleasă (indiferent dacă e ales și un serviciu -- vezi
   * comentariul de la `eligibleResources`) sau când se editează o programare existentă. */
  protected readonly boardDisabled = computed(() => {
    if (this.editingItem()) {
      return false;
    }
    return !this.selectedResource();
  });

  /**
   * Un singur interval doar când se editează o programare existentă (drag pe blocul ei). La rezervarea directă
   * pe resursă, mai multe intervale sunt permise deodată -- fiecare devine o rezervare separată, cu clientul ei.
   */
  protected readonly singleIntervalMode = computed(() => !!this.editingItem());

  constructor() {
    // Încarcă toate programările afacerii o singură dată, din timp -- alimentează atât căutarea de clienți din
    // sidebar, cât și autocomplete-ul de nume/telefon din formularul de rezervare (knownCustomers), fără să
    // depindă de faptul că userul a folosit deja căutarea din sidebar mai întâi.
    effect(() => {
      if (this.business()) {
        this.loadBusinessAppointmentsIfNeeded();
      }
    });

    effect(() => {
      const resources = this.resources();
      if (!resources.length) {
        this.selectedResourceId.set(null);
        this.clearSelection();
        return;
      }

      const selectedResourceId = this.selectedResourceId();
      if (!selectedResourceId || !resources.some((resource) => resource.id === selectedResourceId)) {
        this.selectedResourceId.set(resources[0].id);
      }
    });

    effect(() => {
      const selectedId = this.selectedResourceId();
      const visibleIds = this.visibleResourceIds();
      const apptCache = this.appointmentsByResource();

      const neededIds = new Set<string>(visibleIds);
      if (selectedId) {
        neededIds.add(selectedId);
      }

      for (const resourceId of neededIds) {
        if (!apptCache.has(resourceId)) {
          this.loadResourceAppointments(resourceId);
        }
      }
    });

    // Resincronizează mini-calendarul cu ziua efectiv selectată (ex: după selectDate/pickEditingDate) --
    // dar asta nu re-declanșează la simpla răsfoire prin shiftMonth, care nu atinge `selectedDate`.
    effect(() => {
      this.miniCalendarAnchor.set(this.selectedDate());
    });

    // Week nu e disponibil pe mobil -- dacă ecranul devine mobil cât timp ești în Week, treci pe Day.
    effect(() => {
      if (this.isMobileViewport() && this.viewMode() === 'week') {
        this.viewMode.set('day');
      }
    });

    // "Prima disponibilitate": relevantă doar cu un serviciu ales și fără niciun interval tras pe grilă (un
    // interval tras câștigă mereu, indiferent de durata serviciului -- vezi submitDraftBookings). Cu o resursă
    // preferată aleasă, backend-ul restrânge strict la disponibilitatea EI (nu doar "vreo resursă de tipul
    // cerut"), ca sugestiile să reflecte chiar resursa aleasă.
    effect(() => {
      const serviceId = this.bookingServiceId();
      const dateIso = this.selectedDateIso();
      const preferredResourceId = this.bookingPreferredResourceId();
      const hasDraft = this.drafts().length > 0;

      if (!serviceId || hasDraft || !this.bookingCapacityInputsReady()) {
        this.rawAvailableStarts.set([]);
        return;
      }

      this.api.getAvailableStarts(
        serviceId,
        dateIso,
        preferredResourceId ? [preferredResourceId] : [],
        15,
        this.bookingInputsPayload()
      ).subscribe({
        next: (starts) => this.rawAvailableStarts.set(starts),
        error: () => this.rawAvailableStarts.set([])
      });
    });

    // Dacă resursa preferată nu mai e eligibilă după schimbarea serviciului, revine la "fără preferință" --
    // sigur aici (spre deosebire de `selectedResourceId`), fiindcă acest semnal chiar poate fi null.
    effect(() => {
      const preferred = this.bookingPreferredResourceId();
      if (!preferred) {
        return;
      }
      if (!this.eligibleResources().some((resource) => resource.id === preferred)) {
        this.bookingPreferredResourceId.set(null);
      }
    });

    // Selecția implicită e mereu prima sugestie -- dar clickul manual pe un alt chip (setat direct pe
    // `selectedStart`, în afara acestui effect) nu e suprascris cât timp lista de sugestii nu se schimbă efectiv.
    effect(() => {
      this.selectedStart.set(this.suggestedStarts()[0] ?? null);
    });
  }

  protected onWindowResize(): void {
    this.isMobileViewport.set(this.readIsMobileViewport());
  }

  private readIsMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < this.mobileViewportWidth;
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

  protected goToToday(): void {
    this.setSelectedDate(this.startOfToday(), this.viewMode());
  }

  protected setViewMode(mode: CalendarViewMode): void {
    this.viewMode.set(mode);
  }

  protected shiftRange(offset: number): void {
    const current = this.selectedDate();
    const next = new Date(current);

    switch (this.viewMode()) {
      case 'day':
        next.setDate(current.getDate() + offset);
        break;
      case 'week':
        next.setDate(current.getDate() + offset * 7);
        break;
      case 'month':
        next.setMonth(current.getMonth() + offset);
        break;
      case 'year':
        next.setFullYear(current.getFullYear() + offset);
        break;
    }

    this.setSelectedDate(next, this.viewMode());
  }

  /**
   * Doar navighează luna afișată în mini-calendar (folosit și în selectorul de dată din panoul de editare) --
   * mută `miniCalendarAnchor`, NU `selectedDate`. Altfel, doar răsfoind lunile (fără să alegi efectiv o zi) ai
   * muta și ziua afișată în grila principală, făcând o programare aflată în editare să "dispară" din vizor.
   */
  protected shiftMonth(offset: number): void {
    const next = new Date(this.miniCalendarAnchor());
    next.setMonth(next.getMonth() + offset, 1);
    this.miniCalendarAnchor.set(next);
  }

  protected setSelectedDate(date: Date | string, switchToView: CalendarViewMode = 'day'): void {
    const nextDate = typeof date === 'string' ? this.fromLocalIsoDate(date) : new Date(date);
    this.selectedDate.set(nextDate);
    this.viewMode.set(switchToView);
    this.clearSelection();
  }

  protected selectDate(date: Date | string): void {
    const nextDate = typeof date === 'string' ? this.fromLocalIsoDate(date) : new Date(date);
    this.selectedDate.set(nextDate);
    this.clearSelection();
  }

  protected selectResource(resourceId: string): void {
    this.selectedResourceId.set(resourceId);
    this.clearSelection();
  }

  protected toggleResourceVisibility(resourceId: string): void {
    this.visibleResourceIds.update((current) => {
      const next = new Set(current);
      if (next.has(resourceId)) {
        next.delete(resourceId);
      } else {
        next.add(resourceId);
      }
      return next;
    });
  }

  protected isResourceVisible(resourceId: string): boolean {
    return this.visibleResourceIds().has(resourceId);
  }

  protected removeDraft(id: string): void {
    this.drafts.set(this.drafts().filter((interval) => interval.id !== id));
    this.manualBookingDetails.update((map) => {
      if (!map.has(id)) {
        return map;
      }
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  /** Detaliile de client pentru un draft de rezervare manuală (gol dacă nu s-a completat încă nimic). */
  protected manualDetailsFor(draftId: string): ManualBookingDetails {
    return this.manualBookingDetails().get(draftId) ?? EMPTY_MANUAL_BOOKING_DETAILS;
  }

  protected setManualCustomerName(draftId: string, value: string): void {
    this.updateManualDetails(draftId, { customerName: value });
  }

  protected setManualCustomerPhone(draftId: string, value: string): void {
    this.updateManualDetails(draftId, { customerPhone: value });
  }

  protected setManualLabel(draftId: string, value: string): void {
    this.updateManualDetails(draftId, { manualLabel: value });
  }

  private updateManualDetails(draftId: string, patch: Partial<ManualBookingDetails>): void {
    this.manualBookingDetails.update((map) => {
      const next = new Map(map);
      next.set(draftId, { ...this.manualDetailsFor(draftId), ...patch });
      return next;
    });
  }

  protected intervalLabel(interval: CalendarBoardInterval): string {
    return `${formatCalendarMinutes(interval.startMinutes)} – ${formatCalendarMinutes(interval.endMinutes)}`;
  }

  protected intervalDuration(interval: CalendarBoardInterval): string {
    return calendarIntervalDurationLabel(interval);
  }

  /** "2026-08-03T14:30:00" -> "14:30", pentru chip-urile de "prima disponibilitate". */
  protected formatSuggestedStart(iso: string): string {
    return iso.split('T')[1]?.slice(0, 5) ?? iso;
  }

  protected clearSelection(): void {
    this.drafts.set([]);
    this.manualBookingDetails.set(new Map());
    this.availabilityError.set(null);
    this.selectedAppointment.set(null);
    this.editingItem.set(null);
    this.editingDate.set('');
    this.editingDatePickerOpen.set(false);
    this.clickPoint.set(null);
    this.editEntryDate = null;
  }

  /**
   * Anulează editarea și te întoarce la ziua unde erai înainte să intri în editare -- picking-ul unei date noi
   * din selectorul de dată (pickEditingDate) mută și grila principală acolo, așa că simplul `clearSelection()`
   * te-ar lăsa pe acea dată nouă chiar dacă renunți la editare. Nu se aplică după un SALVARE reușit --
   * acolo rămâi, intenționat, pe data la care tocmai ai mutat programarea.
   */
  protected cancelEditing(): void {
    if (this.editEntryDate) {
      this.selectedDate.set(this.editEntryDate);
    }
    this.clearSelection();
  }

  /** Alege o dată nouă din mini-calendarul din panoul de editare: mută draft-ul pe acea zi și navighează grila acolo. */
  protected pickEditingDate(isoDate: string): void {
    const draft = this.drafts()[0];
    if (draft) {
      this.drafts.set([{ ...draft, date: isoDate }]);
    }
    this.editingDate.set(isoDate);
    this.selectedDate.set(this.fromLocalIsoDate(isoDate));
    this.editingDatePickerOpen.set(false);
  }

  protected setBookingServiceId(serviceId: string): void {
    this.bookingServiceId.set(serviceId || null);
    this.bookingInputs.set(this.buildInitialBookingInputs(serviceId || null));
  }

  /** Alege (sau șterge) resursa preferată din formular. Alegerea uneia concrete o face și activă pe grilă (ca
   * să poți trage un interval pe calendarul ei); revenirea la "fără preferință" NU atinge `selectedResourceId`,
   * care rămâne mereu populat pentru grilă/sidebar -- vezi comentariul de la `bookingPreferredResourceId`. */
  protected setBookingPreferredResource(resourceId: string): void {
    if (resourceId) {
      this.bookingPreferredResourceId.set(resourceId);
      this.selectResource(resourceId);
    } else {
      this.bookingPreferredResourceId.set(null);
    }
  }

  protected setPreferredTimeMinutes(minutes: number | null): void {
    this.preferredTime.set(minutes === null ? null : formatCalendarMinutes(minutes));
  }

  protected bookingInputValue(inputKey: string): number | null {
    return this.bookingInputs()[inputKey] ?? null;
  }

  protected setBookingInputValue(inputKey: string, rawValue: string | number): void {
    const nextValue = rawValue === '' ? null : Number(rawValue);
    const normalizedValue = nextValue !== null && Number.isFinite(nextValue) && nextValue >= 1 ? nextValue : null;
    this.bookingInputs.update((current) => ({
      ...current,
      [inputKey]: normalizedValue
    }));
  }

  protected shouldPromptForCapacityInputs(): boolean {
    return this.bookingCapacityInputs().length > 0 && !this.bookingCapacityInputsReady();
  }

  /**
   * Un interval tras pe grilă câștigă mereu, indiferent dacă un serviciu e ales -- "customizarea" cerută:
   * durata trasă manual are prioritate față de durata implicită a serviciului. Fără niciun interval tras, un
   * serviciu ales înseamnă rezervare pe "prima disponibilitate" (sau chip-ul ales din sugestii). Fără interval
   * și fără serviciu, nu există ce rezerva.
   */
  protected submitBooking(): void {
    if (this.drafts().length) {
      this.submitDraftBookings();
      return;
    }
    if (this.bookingServiceId() && this.selectedStart()) {
      this.submitSuggestedBooking();
      return;
    }
    this.toast.error(this.transloco.translate('dashboard.calendar.errors.selectServiceOrDrag'));
  }

  /** Rezervare pe un timp sugerat (fără interval tras): un singur client, serviciul decide durata. */
  private submitSuggestedBooking(): void {
    const business = this.business();
    const serviceId = this.bookingServiceId();
    const start = this.selectedStart();

    if (!business || !serviceId || !start) {
      return;
    }
    if (!this.bookingCapacityInputsReady()) {
      this.toast.error(this.transloco.translate('dashboard.calendar.errors.capacityInputsRequired'));
      return;
    }
    if (!this.bookingCustomerName().trim() || !this.bookingCustomerPhone().trim()) {
      this.toast.error(this.transloco.translate('dashboard.calendar.errors.customerRequired'));
      return;
    }

    const preferredResourceId = this.bookingPreferredResourceId();
    const request: DashboardCreateAppointmentRequest = {
      businessId: business.id,
      serviceId,
      startTime: start,
      customerName: this.bookingCustomerName().trim(),
      customerPhone: this.bookingCustomerPhone().trim(),
      inputs: this.bookingInputsPayload(),
      preferredResourceIds: preferredResourceId ? [preferredResourceId] : []
    };

    this.api.createAppointment(request).subscribe({
      next: (created) => {
        this.toast.success(
          `Booking created${created.allocations?.length ? ' for ' + created.allocations.map((a) => a.resourceName).join(', ') : ''}.`
        );
        this.refreshAppointmentsForAllocatedResources(created);
        this.resetBookingForm();
      },
      error: (err) => this.toast.error(err?.error?.message ?? this.transloco.translate('dashboard.calendar.errors.createBookingFailed'))
    });
  }

  /**
   * Tragi unul sau mai multe intervale pe grilă pentru resursa aleasă. Serviciul ales (dacă există) e atașat ca
   * referință/etichetă, dar durata rămâne EXACT cea trasă -- nu cea implicită a serviciului. Fiecare interval
   * tras devine o rezervare SEPARATĂ, cu propriul client.
   *
   * Cele două selecții nu se mai unesc automat (mergeDrafts=false pe board), ceea ce înseamnă că e posibil să
   * tragi două intervale care se suprapun -- respins aici înainte de request. Trimiterea e SECVENȚIALĂ
   * (concatMap), nu în paralel (forkJoin): dacă ar fi în paralel, două rezervări din ACELAȘI lot ar putea trece
   * amândouă verificarea de disponibilitate a backend-ului înainte ca oricare să fie efectiv salvată (race
   * clasic check-then-act) -- secvențial, fiecare cerere vede rezervarea anterioară deja salvată.
   */
  private submitDraftBookings(): void {
    const resource = this.selectedResource();
    const business = this.business();
    const drafts = this.drafts();

    if (!resource || !business) {
      this.toast.error(this.transloco.translate('dashboard.calendar.errors.selectResourceFirst'));
      return;
    }

    const overlap = this.findOverlappingDraftPair(drafts);
    if (overlap) {
      this.toast.error(overlap);
      return;
    }

    const serviceId = this.bookingServiceId();
    const requests: DashboardCreateAppointmentRequest[] = [];
    for (const draft of drafts) {
      const details = this.manualDetailsFor(draft.id);
      if (!details.customerName.trim() || !details.customerPhone.trim()) {
        this.toast.error(this.transloco.translate('dashboard.calendar.errors.eachBookingNeedsCustomer'));
        return;
      }
      requests.push({
        businessId: business.id,
        serviceId,
        startTime: this.toIsoDateTime(draft.date, draft.startMinutes),
        endTime: this.toIsoDateTime(draft.date, draft.endMinutes),
        customerName: details.customerName.trim(),
        customerPhone: details.customerPhone.trim(),
        inputs: {},
        preferredResourceIds: [],
        resourceIds: [resource.id],
        manualLabel: details.manualLabel.trim() || undefined
      });
    }

    from(requests)
      .pipe(
        concatMap((request) => this.api.createAppointment(request)),
        toArray()
      )
      .subscribe({
        next: () => {
          this.loadResourceAppointments(resource.id);
          this.toast.success(`Created ${requests.length} booking${requests.length === 1 ? '' : 's'} for ${resource.name}.`);
          this.clearSelection();
          this.resetBookingForm();
        },
        error: (err) => this.toast.error(err?.error?.message ?? this.transloco.translate('dashboard.calendar.errors.createBookingsFailed'))
      });
  }

  /** Verifică perechi de drafturi pe aceeași dată care se suprapun în timp -- respinse înainte de a trimite. */
  private findOverlappingDraftPair(drafts: CalendarBoardInterval[]): string | null {
    const sorted = [...drafts].sort((a, b) =>
      a.date === b.date ? a.startMinutes - b.startMinutes : a.date.localeCompare(b.date)
    );

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous.date === current.date && current.startMinutes < previous.endMinutes) {
        return this.transloco.translate('dashboard.calendar.errors.overlap', {
          a: this.intervalLabel(previous),
          b: this.intervalLabel(current),
          date: current.date
        });
      }
    }
    return null;
  }

  private resetBookingForm(): void {
    this.bookingServiceId.set(null);
    this.bookingPreferredResourceId.set(null);
    this.bookingCustomerName.set('');
    this.bookingCustomerPhone.set('');
    this.bookingInputs.set({});
    this.manualBookingDetails.set(new Map());
    this.preferredTime.set(null);
  }

  private bookingInputsPayload(): Record<string, number> {
    return Object.fromEntries(
      this.bookingCapacityInputs()
        .map((input) => [input.key, this.bookingInputs()[input.key]])
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 1)
    );
  }

  private buildInitialBookingInputs(serviceId: string | null): Record<string, number | null> {
    const service = this.services().find((item) => item.id === serviceId);
    if (!service) {
      return {};
    }

    const inputs: Record<string, number | null> = {};
    for (const requirement of service.requirements) {
      if (requirement.fulfillmentMode === 'CAPACITY' && requirement.capacityInputKey) {
        inputs[requirement.capacityInputKey] = inputs[requirement.capacityInputKey] ?? null;
      }
    }
    return inputs;
  }

  protected onEventClicked(event: { trackId: string; event: CalendarBoardInterval; clientX: number; clientY: number }): void {
    if (this.editingItem()) {
      // click-ul e absorbit de drag-ul de editare aflat în desfășurare
      return;
    }
    if (!event.trackId.endsWith('-appointments')) {
      return;
    }

    const resourceId = event.trackId.slice(0, -'-appointments'.length);
    const appointment = (this.appointmentsByResource().get(resourceId) ?? []).find(
      (candidate) => candidate.id === event.event.id
    );
    if (!appointment) {
      this.selectedAppointment.set(null);
      return;
    }
    this.clickPoint.set({ x: event.clientX, y: event.clientY });
    this.selectedAppointment.set(appointment);
  }

  protected beginEditingSelectedAppointment(): void {
    const appointment = this.selectedAppointment();
    const resourceId = this.selectedResourceId();
    if (!appointment || !resourceId || !this.selectedAppointmentEditable()) {
      return;
    }

    // Sare în colțul opus punctului de click, ca panoul să nu acopere blocul cât timp e tras pe grilă.
    this.editPanelCorner.set(this.cornerAwayFrom(this.clickPoint()));
    this.editEntryDate = this.selectedDate();
    this.editingItem.set({ id: appointment.id, resourceId });
    this.editingDate.set(appointment.startTime.split('T')[0]);
    this.drafts.set([this.toAppointmentEvent(appointment)]);
    this.selectedAppointment.set(null);
  }

  protected saveEditedItem(): void {
    const editing = this.editingItem();
    const draft = this.drafts()[0];
    if (!editing || !draft) {
      return;
    }
    const date = this.editingDate() || draft.date;

    this.availabilityError.set(null);
    this.availabilityMessage.set(null);

    this.api
      .rescheduleAppointment(editing.id, this.toIsoDateTime(date, draft.startMinutes), this.toIsoDateTime(date, draft.endMinutes))
      .subscribe({
        next: () => {
          this.loadResourceAppointments(editing.resourceId, this.transloco.translate('dashboard.calendar.messages.rescheduled'));
          this.clearSelection();
        },
        error: (err) => this.availabilityError.set(err?.error?.message ?? this.transloco.translate('dashboard.calendar.errors.rescheduleFailed'))
      });
  }

  protected closeAppointmentDetail(): void {
    this.selectedAppointment.set(null);
    this.clickPoint.set(null);
  }

  protected onClientSearchInput(value: string): void {
    this.clientSearchQuery.set(value);
    this.loadBusinessAppointmentsIfNeeded();
  }

  private loadBusinessAppointmentsIfNeeded(): void {
    const business = this.business();
    if (!business || this.businessAppointmentsRequested) {
      return;
    }
    this.businessAppointmentsRequested = true;
    this.api
      .getAppointments(business.id)
      .pipe(catchError(() => of([] as DashboardAppointment[])))
      .subscribe((appointments) => this.businessAppointments.set(appointments));
  }

  protected jumpToAppointment(appointment: DashboardAppointment, event: MouseEvent): void {
    const resourceId = appointment.allocations?.[0]?.resourceId;
    this.setSelectedDate(appointment.startTime.split('T')[0], 'day');
    if (resourceId) {
      this.selectedResourceId.set(resourceId);
    }
    this.clickPoint.set({ x: event.clientX, y: event.clientY });
    this.selectedAppointment.set(appointment);
  }

  protected confirmSelectedAppointment(): void {
    this.runAppointmentAction((id) => this.api.confirmAppointment(id));
  }

  protected cancelSelectedAppointment(): void {
    this.runAppointmentAction((id) => this.api.cancelAppointment(id));
  }

  protected completeSelectedAppointment(): void {
    this.runAppointmentAction((id) => this.api.completeAppointment(id));
  }

  protected deleteSelectedAppointment(): void {
    const appointment = this.selectedAppointment();
    if (!appointment) {
      return;
    }
    this.api.removeAppointment(appointment.id).subscribe({
      next: () => {
        this.selectedAppointment.set(null);
        this.refreshAppointmentsForAllocatedResources(appointment);
      },
      error: () => this.availabilityError.set(this.transloco.translate('dashboard.calendar.errors.deleteFailed'))
    });
  }

  private runAppointmentAction(action: (id: string) => Observable<DashboardAppointment>): void {
    const appointment = this.selectedAppointment();
    if (!appointment) {
      return;
    }
    action(appointment.id).subscribe({
      next: (updated) => {
        this.selectedAppointment.set(updated);
        this.refreshAppointmentsForAllocatedResources(updated);
      },
      error: () => this.availabilityError.set(this.transloco.translate('dashboard.calendar.errors.updateFailed'))
    });
  }

  private refreshAppointmentsForAllocatedResources(appointment: DashboardAppointment): void {
    const resourceIds = new Set((appointment.allocations ?? []).map((allocation) => allocation.resourceId));
    for (const resourceId of resourceIds) {
      this.loadResourceAppointments(resourceId);
    }
  }

  protected openDayInDayTab(day: Date | string): void {
    this.setSelectedDate(day, 'day');
  }

  private toAppointmentEvent(appointment: DashboardAppointment): CalendarBoardInterval {
    const [date, time] = appointment.startTime.split('T');
    const [, endTimeRaw] = appointment.endTime.split('T');
    return {
      id: appointment.id,
      date,
      startMinutes: parseCalendarTime(time.slice(0, 5)),
      endMinutes: parseCalendarTime(endTimeRaw.slice(0, 5)),
      title: appointment.serviceName ?? appointment.manualLabel ?? this.transloco.translate('dashboard.calendar.manualBookingFallback'),
      subtitle: appointment.customerName,
      muted: appointment.status === 'CANCELLED'
    };
  }

  private appointmentDurationSeconds(appointment: DashboardAppointment): number {
    return (new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 1000;
  }

  /** "2026-07-31T11:20:00" / "2026-07-31T14:20:00" -> "Jul 31 · 11:20 – 14:20", pentru popover-ul de vizualizare. */
  protected formatAppointmentTimeRange(appointment: DashboardAppointment): string {
    const [startDate, startTime] = appointment.startTime.split('T');
    const [, endTime] = appointment.endTime.split('T');
    const dateLabel = this.formatShortDate(this.fromLocalIsoDate(startDate));
    return `${dateLabel} · ${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`;
  }

  protected appointmentKindLabel(kind: 'service' | 'manual' | 'manual-service'): string {
    switch (kind) {
      case 'service':
        return this.transloco.translate('dashboard.calendar.serviceBookingKind');
      case 'manual-service':
        return this.transloco.translate('dashboard.calendar.manualServiceBookingKind');
      default:
        return this.transloco.translate('dashboard.calendar.manualBookingKind');
    }
  }

  /**
   * Popover-ul apare exact la punctul de click; îl mutăm doar cât să încapă în fereastră (nu-l centrăm, nu-l
   * mutăm lângă bloc -- doar un clamp minim spre interior când ar ieși din ecran pe o margine).
   */
  private clampNearPoint(point: { x: number; y: number } | null): { left: string; top: string } {
    if (!point) {
      return { left: '-9999px', top: '-9999px' };
    }

    const width = 320;
    const estimatedHeight = 420;
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = Math.max(margin, Math.min(point.x, viewportWidth - width - margin));
    const top = Math.max(margin, Math.min(point.y, viewportHeight - estimatedHeight - margin));

    return { left: `${left}px`, top: `${top}px` };
  }

  /**
   * Alege stânga/dreapta jos, opus punctului de click pe orizontală -- rămâne mereu în partea de jos (unde a
   * stat dintotdeauna panoul de editare) ca să nu "sară" sus pe ecran doar pentru că blocul a fost tras din
   * partea de jos a grilei, ceea ce arăta ca o schimbare de layout neașteptată.
   */
  private cornerAwayFrom(point: { x: number; y: number } | null): ScreenCorner {
    const viewportWidth = window.innerWidth;
    const x = point?.x ?? viewportWidth / 2;
    return x < viewportWidth / 2 ? 'bottom-right' : 'bottom-left';
  }

  private toIsoDateTime(dateIso: string, minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${dateIso}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  }

  /** Culoare stabilă per resursă (folosită atât pentru chip-urile din grilă, cât și pentru toggle-ul din sidebar). */
  protected resourceTone(resourceId: string): string {
    return `hsl(${this.resourceHue(resourceId)} 70% 50%)`;
  }

  /** Variantă deschisă a aceleiași nuanțe, pentru fundalul toggle-ului activ. */
  protected resourceToneSoft(resourceId: string): string {
    return `hsl(${this.resourceHue(resourceId)} 70% 94%)`;
  }

  /**
   * Hash-ul evită banda albastru/azur (200°–270°) rezervată vizual resursei selectate,
   * ca să nu existe confuzie între "altă resursă" și "resursa curentă" pe grilă.
   */
  private resourceHue(resourceId: string): number {
    let hash = 0;
    for (let index = 0; index < resourceId.length; index += 1) {
      hash = (hash << 5) - hash + resourceId.charCodeAt(index);
      hash |= 0;
    }

    const excludedStart = 200;
    const excludedWidth = 70;
    const usableSpan = 360 - excludedWidth;
    const raw = Math.abs(hash) % usableSpan;
    return raw < excludedStart ? raw : raw + excludedWidth;
  }

  // ---------- construcție grile ----------

  private buildWeekDays(anchorDate: Date): CalendarDay[] {
    const start = this.startOfWeek(anchorDate);
    const todayIso = this.toLocalIsoDate(new Date());

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const isoDate = this.toLocalIsoDate(date);

      return {
        date,
        isoDate,
        label: new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { weekday: 'short' }).format(date),
        dayNumber: date.getDate(),
        isToday: isoDate === todayIso,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isCurrentMonth: date.getMonth() === anchorDate.getMonth()
      };
    });
  }

  private buildMonthCells(anchorDate: Date, startOnMonday = false): CalendarMonthCell[] {
    const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const month = firstOfMonth.getMonth();
    const startDay = startOnMonday ? (firstOfMonth.getDay() + 6) % 7 : firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - startDay);
    const selectedIso = this.toLocalIsoDate(anchorDate);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const isoDate = this.toLocalIsoDate(date);

      return {
        date,
        isoDate,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isSelected: isoDate === selectedIso,
        appointmentCount: this.appointmentCountForDate(isoDate)
      };
    });
  }

  private buildYearMonths(year: number): CalendarYearMonth[] {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const date = new Date(year, monthIndex, 1);
      const cells = this.buildMonthCells(date);
      const weeks: CalendarMonthCell[][] = [];

      for (let index = 0; index < cells.length; index += 7) {
        weeks.push(cells.slice(index, index + 7));
      }

      return {
        monthIndex,
        label: new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { month: 'long' }).format(date),
        weeks
      };
    });
  }

  private appointmentCountForDate(dayIsoDate: string): number {
    const resourceId = this.selectedResourceId();
    if (!resourceId) {
      return 0;
    }
    return (this.appointmentsByResource().get(resourceId) ?? []).filter(
      (appointment) => appointment.startTime.split('T')[0] === dayIsoDate
    ).length;
  }

  private loadResourceAppointments(resourceId: string, successMessage: string | null = null): void {
    this.api
      .getAppointmentsByResource(resourceId)
      .pipe(catchError(() => of([] as DashboardAppointment[])))
      .subscribe((appointments) => {
        this.appointmentsByResource.update((cache) => new Map(cache).set(resourceId, appointments));
        if (successMessage) {
          this.availabilityMessage.set(successMessage);
        }
      });
  }

  private formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat(INTL_LOCALES[this.activeLang()], { month: 'short', day: 'numeric' }).format(date);
  }

  private startOfToday(): Date {
    return this.startOfDay(new Date());
  }

  private startOfDay(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private startOfWeek(date: Date): Date {
    const next = this.startOfDay(date);
    const dayOfWeek = next.getDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    next.setDate(next.getDate() - mondayOffset);
    return next;
  }

  protected toLocalIsoDate(date: Date): string {
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
