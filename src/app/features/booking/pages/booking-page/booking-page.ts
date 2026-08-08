import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { createDefaultBusinessConfirmationSettings } from '../../../../core/models/business-confirmation-settings.model';
import {
	extractAddressFromGoogleMapsLink,
	isGoogleMapsLink
} from '../../../../core/utils/google-maps';
import { resolveTenantSlug } from '../../../../core/config/tenant.config';
import { LanguageSwitcher } from '../../../../shared/language-switcher/language-switcher';
import { PhoneInputComponent } from '../../../../shared/phone-input/phone-input';
import { BookingApiService } from '../../data-access/booking-api.service';
import { ChatWebSocketService } from '../../data-access/chat-websocket.service';
import {
	BookingConfirmation,
	PublicBusiness,
	PublicService,
	PublicServiceRequirement
} from '../../models/booking.model';

type BookingStep = 'service' | 'schedule' | 'details' | 'confirmed';
type BookingMode = 'manual' | 'chat';

interface ChatMessage {
	role: 'assistant' | 'user';
	text: string;
}

interface CalendarDay {
	isoDate: string;
	dayNumber: number;
	isCurrentMonth: boolean;
	isPast: boolean;
}

interface CapacityInputDefinition {
	key: string;
	resourceTypeName: string;
}

const WEEKDAY_LABELS: Record<string, string[]> = {
	en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
	ro: ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']
};
const WEEKDAY_HEADER_LABELS: Record<string, string[]> = {
	en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
	ro: ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum']
};
const MONTH_LABELS: Record<string, string[]> = {
	en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
	ro: ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.']
};
const FULL_MONTH_LABELS: Record<string, string[]> = {
	en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
	ro: ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
};

function toIsoDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Monday-start 6-week grid for the given month, trimmed of a trailing row that's entirely
 * next month (so a short month renders 5 rows instead of always reserving 6). */
function buildCalendarDays(monthStart: Date, todayIso: string): CalendarDay[] {
	const month = monthStart.getMonth();
	const firstWeekdayMondayIndexed = (monthStart.getDay() + 6) % 7;
	const gridStart = new Date(monthStart.getFullYear(), month, 1 - firstWeekdayMondayIndexed);

	const days: CalendarDay[] = [];
	for (let i = 0; i < 42; i++) {
		const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
		const isoDate = toIsoDate(date);
		days.push({
			isoDate,
			dayNumber: date.getDate(),
			isCurrentMonth: date.getMonth() === month,
			isPast: isoDate < todayIso
		});
	}

	const lastRow = days.slice(35, 42);
	return lastRow.every((day) => !day.isCurrentMonth) ? days.slice(0, 35) : days;
}

/** Public, unauthenticated booking flow reached via a shared link (`/book/:businessId`) -- a client
 * picks a service, a date, an open slot, then confirms with just their name and phone. No login,
 * no dashboard chrome: this is the "client-facing" counterpart to the WhatsApp booking path. */
@Component({
	selector: 'app-booking-page',
	imports: [FormsModule, TranslocoPipe, LanguageSwitcher, PhoneInputComponent],
	templateUrl: './booking-page.html',
	styleUrl: './booking-page.scss'
})
export class BookingPage implements OnInit, OnDestroy {
	private readonly route = inject(ActivatedRoute);
	private readonly bookingApi = inject(BookingApiService);
	private readonly chatWs = inject(ChatWebSocketService);
	private readonly transloco = inject(TranslocoService);
	private readonly destroy$ = new Subject<void>();

	/** Generated once per page load; routes WS replies back to this browser tab. */
	private readonly conversationId = crypto.randomUUID();

	/** Set once resolution finishes -- either straight from the `:businessId` path param (the
	 * `/book/:businessId` fallback route, handy for local testing without subdomain setup), or from
	 * looking up the tenant slug resolved from the current hostname (the normal `slug.fastappoint.app`
	 * path, where the URL itself carries no business id at all). */
	private businessId = '';

	protected readonly loadingBusiness = signal(true);
	protected readonly loadError = signal<string | null>(null);
	protected readonly business = signal<PublicBusiness | null>(null);
	protected readonly services = signal<PublicService[]>([]);
	protected readonly mode = signal<BookingMode>('manual');

	protected readonly step = signal<BookingStep>('service');
	protected readonly selectedService = signal<PublicService | null>(null);

	private readonly activeLang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

	private readonly todayIso = toIsoDate(new Date());
	protected readonly viewedMonthStart = signal(startOfMonth(new Date()));
	protected readonly calendarDays = computed(() => buildCalendarDays(this.viewedMonthStart(), this.todayIso));
	protected readonly monthLabel = computed(() => {
		const start = this.viewedMonthStart();
		return `${FULL_MONTH_LABELS[this.activeLang()][start.getMonth()]} ${start.getFullYear()}`;
	});
	protected readonly canGoPreviousMonth = computed(() => this.viewedMonthStart() > startOfMonth(new Date()));
	protected readonly weekdayHeaderLabels = computed(() => WEEKDAY_HEADER_LABELS[this.activeLang()]);

	protected readonly selectedDate = signal<string | null>(null);
	protected readonly loadingSlots = signal(false);
	protected readonly slotsError = signal<string | null>(null);
	protected readonly availableStarts = signal<string[]>([]);
	protected readonly selectedStart = signal<string | null>(null);
	protected readonly bookingInputs = signal<Record<string, number | null>>({});

	protected readonly customerName = signal('');
	protected readonly customerPhone = signal('');
	protected readonly submitting = signal(false);
	protected readonly submitError = signal<string | null>(null);
	protected readonly confirmation = signal<BookingConfirmation | null>(null);
	protected readonly confirmationSettings = computed(
		() => this.confirmation()?.confirmationSettings ?? createDefaultBusinessConfirmationSettings()
	);
	protected readonly confirmationLocationInfo = computed(
		() => this.confirmationSettings().locationInfo || extractAddressFromGoogleMapsLink(this.confirmationSettings().googleMapsLink) || ''
	);
	protected readonly confirmationGoogleMapsLink = computed(() => {
		const link = this.confirmationSettings().googleMapsLink;
		return isGoogleMapsLink(link) ? link : null;
	});
	protected readonly chatPhoneNumber = computed(() => this.business()?.chatPhoneNumber?.trim() ?? '');
	protected readonly chatBusinessDescription = computed(() => this.business()?.description?.trim() ?? '');
	protected readonly chatMessages = signal<ChatMessage[]>([]);
	protected readonly chatDraft = signal('');
	protected readonly chatCustomerName = signal('');
	protected readonly chatCustomerPhone = signal('');
	protected readonly chatSending = signal(false);
	protected readonly chatError = signal<string | null>(null);
	protected readonly capacityInputDefinitions = computed<CapacityInputDefinition[]>(() => {
		const service = this.selectedService();
		if (!service) {
			return [];
		}

		const definitions = new Map<string, CapacityInputDefinition>();
		for (const requirement of service.requirements ?? []) {
			if (requirement.fulfillmentMode !== 'CAPACITY' || !requirement.capacityInputKey) {
				continue;
			}
			if (!definitions.has(requirement.capacityInputKey)) {
				definitions.set(requirement.capacityInputKey, {
					key: requirement.capacityInputKey,
					resourceTypeName: requirement.resourceTypeName
				});
			}
		}
		return Array.from(definitions.values());
	});
	protected readonly bookingInputsReady = computed(() =>
		this.capacityInputDefinitions().every((definition) => {
			const value = this.bookingInputs()[definition.key];
			return typeof value === 'number' && Number.isFinite(value) && value >= 1;
		})
	);

	constructor() {
		const routeBusinessId = this.route.snapshot.paramMap.get('businessId');
		const tenantSlug = resolveTenantSlug();

		if (routeBusinessId) {
			this.bookingApi.getBusiness(routeBusinessId).subscribe({
				next: (business) => this.onBusinessResolved(business),
				error: () => this.onBusinessResolutionFailed()
			});
			return;
		}
		if (tenantSlug) {
			this.bookingApi.getBusinessBySlug(tenantSlug).subscribe({
				next: (business) => this.onBusinessResolved(business),
				error: () => this.onBusinessResolutionFailed()
			});
			return;
		}

		this.loadingBusiness.set(false);
		this.loadError.set('booking.error.missingBusiness');
	}

	private onBusinessResolved(business: PublicBusiness): void {
		this.businessId = business.id;
		this.business.set(business);
		this.chatMessages.set([
			{
				role: 'assistant',
				text: this.transloco.translate('booking.chat.welcome', { business: business.name })
			}
		]);
		this.bookingApi.getServices(business.id).subscribe({
			next: (services) => {
				this.services.set(services);
				this.loadingBusiness.set(false);
			},
			error: () => {
				this.loadingBusiness.set(false);
				this.loadError.set('booking.error.servicesLoadFailed');
			}
		});
	}

	private onBusinessResolutionFailed(): void {
		this.loadingBusiness.set(false);
		this.loadError.set('booking.error.notFound');
	}

	protected serviceDurationLabel(service: PublicService): string {
		const minutes = Math.round(service.durationSeconds / 60);
		if (minutes < 60) {
			return this.transloco.translate('booking.duration.minutesShort', { minutes });
		}
		const hours = Math.floor(minutes / 60);
		const remainder = minutes % 60;
		return remainder === 0
			? this.transloco.translate('booking.duration.hoursOnly', { hours })
			: this.transloco.translate('booking.duration.hoursMinutes', { hours, minutes: remainder });
	}

	protected setMode(mode: BookingMode): void {
		this.mode.set(mode);
	}

	protected selectService(service: PublicService): void {
		this.selectedService.set(service);
		this.bookingInputs.set(this.buildInitialInputs(service.requirements ?? []));
		this.step.set('schedule');
		this.selectedStart.set(null);
		const defaultDate = this.selectedDate() ?? this.todayIso;
		this.selectDate(defaultDate);
	}

	protected selectDate(isoDate: string): void {
		if (isoDate < this.todayIso) {
			return;
		}
		this.selectedDate.set(isoDate);
		this.selectedStart.set(null);
		this.fetchSlots();
	}

	protected previousMonth(): void {
		if (!this.canGoPreviousMonth()) {
			return;
		}
		const start = this.viewedMonthStart();
		this.viewedMonthStart.set(new Date(start.getFullYear(), start.getMonth() - 1, 1));
	}

	protected nextMonth(): void {
		const start = this.viewedMonthStart();
		this.viewedMonthStart.set(new Date(start.getFullYear(), start.getMonth() + 1, 1));
	}

	private fetchSlots(): void {
		const service = this.selectedService();
		const date = this.selectedDate();
		if (!service || !date) {
			return;
		}
		if (!this.bookingInputsReady()) {
			this.loadingSlots.set(false);
			this.slotsError.set(null);
			this.availableStarts.set([]);
			return;
		}
		this.loadingSlots.set(true);
		this.slotsError.set(null);
		this.availableStarts.set([]);
		this.bookingApi.getAvailableStarts(service.id, date, this.bookingInputsPayload()).subscribe({
			next: (starts) => {
				this.loadingSlots.set(false);
				this.availableStarts.set(starts);
			},
			error: () => {
				this.loadingSlots.set(false);
				this.slotsError.set('booking.error.slotsLoadFailed');
			}
		});
	}

	protected timeLabel(iso: string): string {
		return this.to12Hour(iso.split('T')[1]?.slice(0, 5) ?? '');
	}

	/** "Fri, Aug 1 · 2:30 PM" -- built from the naive LocalDateTime string's own date/time parts
	 * (never through `Date` parsing/UTC conversion, which would silently shift the displayed day). */
	protected dateTimeSummary(iso: string): string {
		const [datePart, timePart] = iso.split('T');
		const [year, month, day] = datePart.split('-').map(Number);
		const localDate = new Date(year, month - 1, day);
		const lang = this.activeLang();
		const weekday = WEEKDAY_LABELS[lang][localDate.getDay()];
		const monthLabel = MONTH_LABELS[lang][localDate.getMonth()];
		return `${weekday}, ${monthLabel} ${day} · ${this.to12Hour(timePart?.slice(0, 5) ?? '')}`;
	}

	private to12Hour(hhmm: string): string {
		const [hoursRaw, minutes] = hhmm.split(':');
		const hours = Number(hoursRaw);
		if (Number.isNaN(hours) || !minutes) {
			return hhmm;
		}
		const period = hours >= 12 ? 'PM' : 'AM';
		const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
		return `${twelveHour}:${minutes} ${period}`;
	}

	protected selectStart(iso: string): void {
		this.selectedStart.set(iso);
		this.submitError.set(null);
		this.step.set('details');
	}

	protected backToService(): void {
		this.step.set('service');
	}

	protected backToSchedule(): void {
		this.step.set('schedule');
	}

	/** Lets a client jump straight to any step they've already reached, via the progress bar --
	 * only gated by whether that step has what it needs (a service picked, then a slot picked). */
	protected goToStep(target: BookingStep): void {
		if (target === 'schedule' && !this.selectedService()) {
			return;
		}
		if (target === 'details' && (!this.selectedService() || !this.selectedStart())) {
			return;
		}
		if (target === 'confirmed') {
			return;
		}
		this.step.set(target);
	}

	protected canJumpToStep(target: BookingStep): boolean {
		if (target === 'schedule') {
			return !!this.selectedService();
		}
		if (target === 'details') {
			return !!this.selectedService() && !!this.selectedStart();
		}
		return true;
	}

	protected confirmBooking(): void {
		const service = this.selectedService();
		const start = this.selectedStart();
		if (!service || !start) {
			return;
		}
		if (!this.bookingInputsReady()) {
			this.submitError.set('booking.error.missingCapacityInputs');
			return;
		}
		if (!this.customerName().trim() || !this.customerPhone().trim()) {
			this.submitError.set('booking.error.missingDetails');
			return;
		}
		this.submitting.set(true);
		this.submitError.set(null);
		this.bookingApi
			.createBooking({
				businessId: this.businessId,
				serviceId: service.id,
				startTime: start,
				customerName: this.customerName().trim(),
				customerPhone: this.customerPhone().trim(),
				inputs: this.bookingInputsPayload()
			})
			.subscribe({
				next: (confirmation) => {
					this.submitting.set(false);
					this.confirmation.set(confirmation);
					this.step.set('confirmed');
				},
				error: (err) => {
					this.submitting.set(false);
					this.submitError.set(err?.error?.message ?? 'booking.error.slotUnavailable');
				}
			});
	}

	protected bookAnother(): void {
		this.step.set('service');
		this.selectedService.set(null);
		this.selectedStart.set(null);
		this.availableStarts.set([]);
		this.customerName.set('');
		this.customerPhone.set('');
		this.bookingInputs.set({});
		this.confirmation.set(null);
		this.submitError.set(null);
	}

	ngOnInit(): void {
		this.chatWs
			.messages$(this.conversationId)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: (wsMsg) => {
					if (wsMsg.type === 'typing') {
						return; // keep spinner; a reply/error frame follows
					}
					this.chatSending.set(false);
					if (wsMsg.type === 'reply') {
						const text = wsMsg.reply?.trim() || this.transloco.translate('booking.chat.fallbackReply');
						this.chatMessages.update((messages) => [...messages, { role: 'assistant', text: text as string }]);
					} else {
						const errorKey = wsMsg.error === 'rate_limit_exceeded'
							? 'booking.chat.error.rateLimitExceeded'
							: wsMsg.error === 'invalid_phone'
							? 'booking.chat.error.phoneInvalid'
							: 'booking.chat.error.sendFailed';
						this.chatError.set(errorKey);
					}
				},
				error: () => {
					this.chatSending.set(false);
					this.chatError.set('booking.chat.error.sendFailed');
				}
			});
	}

	protected sendChatMessage(): void {
		const toPhoneNumber = this.chatPhoneNumber();
		if (!toPhoneNumber) {
			this.chatError.set('booking.chat.error.notConfigured');
			return;
		}
		const message = this.chatDraft().trim();
		if (!message) {
			return;
		}
		const fromPhoneNumber = this.chatCustomerPhone().trim();
		if (!fromPhoneNumber) {
			this.chatError.set('booking.chat.error.phoneRequired');
			return;
		}

		this.chatMessages.update((messages) => [...messages, { role: 'user', text: message }]);
		this.chatDraft.set('');
		this.chatError.set(null);
		this.chatSending.set(true);

		this.chatWs.send({
			conversationId: this.conversationId,
			toPhoneNumber,
			fromPhoneNumber,
			customerName: this.chatCustomerName().trim() || undefined,
			message
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	protected inputValue(inputKey: string): number | null {
		return this.bookingInputs()[inputKey] ?? null;
	}

	protected setInputValue(inputKey: string, rawValue: string | number): void {
		const nextValue = rawValue === '' ? null : Number(rawValue);
		const normalizedValue = nextValue !== null && Number.isFinite(nextValue) && nextValue >= 1 ? nextValue : null;
		this.bookingInputs.update((current) => ({
			...current,
			[inputKey]: normalizedValue
		}));
		if (this.selectedDate()) {
			this.fetchSlots();
		}
	}

	protected shouldPromptForCapacityInputs(): boolean {
		return this.capacityInputDefinitions().length > 0 && !this.bookingInputsReady();
	}

	private bookingInputsPayload(): Record<string, number> {
		return Object.fromEntries(
			this.capacityInputDefinitions()
				.map((definition) => [definition.key, this.bookingInputs()[definition.key]])
				.filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 1)
		);
	}

	private buildInitialInputs(requirements: PublicServiceRequirement[]): Record<string, number | null> {
		const inputs: Record<string, number | null> = {};
		for (const requirement of requirements) {
			if (requirement.fulfillmentMode === 'CAPACITY' && requirement.capacityInputKey) {
				inputs[requirement.capacityInputKey] = inputs[requirement.capacityInputKey] ?? null;
			}
		}
		return inputs;
	}
}
