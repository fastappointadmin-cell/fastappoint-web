import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
	BusinessConfirmationSettings,
	normalizeBusinessConfirmationSettings
} from '../../../../core/models/business-confirmation-settings.model';
import {
	extractAddressFromGoogleMapsLink,
	isGoogleMapsLink,
	normalizeGoogleMapsLink
} from '../../../../core/utils/google-maps';
import { EditPanelComponent } from '../../components/edit-panel/edit-panel';
import { DashboardFacade } from '../../data-access/dashboard-facade';

@Component({
	selector: 'app-dashboard-confirmation-message-page',
	imports: [EditPanelComponent, FormsModule, TranslocoPipe],
	templateUrl: './dashboard-confirmation-message-page.html',
	styleUrl: './dashboard-confirmation-message-page.scss'
})
export class DashboardConfirmationMessagePage {
	private readonly facade = inject(DashboardFacade);
	protected readonly reminderLeadTimeOptions = [15, 30, 60, 120, 180, 720, 1440, 2880];

	protected readonly selectedBusiness = this.facade.selectedBusiness;

	protected readonly confirmationMessage = signal('');
	protected readonly confirmationLocationInfo = signal('');
	protected readonly confirmationGoogleMapsLink = signal('');
	protected readonly confirmationEnabled = signal(true);
	protected readonly confirmationIncludeLocationInfo = signal(false);
	protected readonly confirmationIncludeTime = signal(true);
	protected readonly confirmationIncludeBookingSlot = signal(true);
	private readonly lastAutoDerivedConfirmationLocation = signal('');

	protected readonly reminderMessage = signal('');
	protected readonly reminderLocationInfo = signal('');
	protected readonly reminderGoogleMapsLink = signal('');
	protected readonly reminderEnabled = signal(true);
	protected readonly reminderIncludeLocationInfo = signal(false);
	protected readonly reminderIncludeTime = signal(true);
	protected readonly reminderIncludeBookingSlot = signal(true);
	protected readonly reminderLeadTimeMinutes = signal(1440);
	private readonly lastAutoDerivedReminderLocation = signal('');

	protected readonly savedConfirmationSettings = computed(() =>
		normalizeBusinessConfirmationSettings(this.selectedBusiness()?.confirmationSettings)
	);
	protected readonly savedReminderSettings = computed(() =>
		normalizeBusinessConfirmationSettings(this.selectedBusiness()?.reminderSettings)
	);

	protected readonly extractedConfirmationLocationFromLink = computed(
		() => extractAddressFromGoogleMapsLink(this.confirmationGoogleMapsLink()) ?? ''
	);
	protected readonly extractedReminderLocationFromLink = computed(
		() => extractAddressFromGoogleMapsLink(this.reminderGoogleMapsLink()) ?? ''
	);

	protected readonly hasValidConfirmationGoogleMapsLink = computed(() =>
		isGoogleMapsLink(this.confirmationGoogleMapsLink())
	);
	protected readonly hasValidReminderGoogleMapsLink = computed(() => isGoogleMapsLink(this.reminderGoogleMapsLink()));

	protected readonly resolvedConfirmationLocationInfo = computed(
		() => this.confirmationLocationInfo().trim() || this.extractedConfirmationLocationFromLink()
	);
	protected readonly resolvedReminderLocationInfo = computed(
		() => this.reminderLocationInfo().trim() || this.extractedReminderLocationFromLink()
	);

	protected readonly confirmationDraftSettings = computed<BusinessConfirmationSettings>(() => ({
		message: this.confirmationMessage().trim(),
		locationInfo: this.resolvedConfirmationLocationInfo(),
		googleMapsLink: normalizeGoogleMapsLink(this.confirmationGoogleMapsLink()),
		enabled: this.confirmationEnabled(),
		includeLocationInfo: this.confirmationIncludeLocationInfo(),
		includeTime: this.confirmationIncludeTime(),
		includeBookingSlot: this.confirmationIncludeBookingSlot(),
		reminderLeadTimeMinutes: this.savedConfirmationSettings().reminderLeadTimeMinutes
	}));

	protected readonly reminderDraftSettings = computed<BusinessConfirmationSettings>(() => ({
		message: this.reminderMessage().trim(),
		locationInfo: this.resolvedReminderLocationInfo(),
		googleMapsLink: normalizeGoogleMapsLink(this.reminderGoogleMapsLink()),
		enabled: this.reminderEnabled(),
		includeLocationInfo: this.reminderIncludeLocationInfo(),
		includeTime: this.reminderIncludeTime(),
		includeBookingSlot: this.reminderIncludeBookingSlot(),
		reminderLeadTimeMinutes: this.reminderLeadTimeMinutes()
	}));

	protected readonly hasUnsavedConfirmationChanges = computed(() =>
		this.settingsDiffer(this.confirmationDraftSettings(), this.savedConfirmationSettings())
	);
	protected readonly hasUnsavedReminderChanges = computed(() =>
		this.settingsDiffer(this.reminderDraftSettings(), this.savedReminderSettings())
	);

	constructor() {
		effect(() => {
			this.resetConfirmationDraft(this.savedConfirmationSettings());
			this.resetReminderDraft(this.savedReminderSettings());
		});
	}

	protected saveConfirmation(): void {
		this.facade.updateBusinessConfirmationSettings(this.confirmationDraftSettings());
	}

	protected undoConfirmation(): void {
		this.resetConfirmationDraft(this.savedConfirmationSettings());
	}

	protected saveReminder(): void {
		this.facade.updateBusinessReminderSettings(this.reminderDraftSettings());
	}

	protected undoReminder(): void {
		this.resetReminderDraft(this.savedReminderSettings());
	}

	protected onConfirmationGoogleMapsLinkChange(value: string): void {
		this.applyGoogleMapsLinkChange(
			value,
			this.confirmationLocationInfo,
			this.confirmationGoogleMapsLink,
			this.lastAutoDerivedConfirmationLocation
		);
	}

	protected onReminderGoogleMapsLinkChange(value: string): void {
		this.applyGoogleMapsLinkChange(
			value,
			this.reminderLocationInfo,
			this.reminderGoogleMapsLink,
			this.lastAutoDerivedReminderLocation
		);
	}

	protected onConfirmationLocationInfoChange(value: string): void {
		this.confirmationLocationInfo.set(value);
	}

	protected onReminderLocationInfoChange(value: string): void {
		this.reminderLocationInfo.set(value);
	}

	protected onReminderLeadTimeMinutesChange(value: string | number): void {
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed >= 5) {
			this.reminderLeadTimeMinutes.set(parsed);
		}
	}

	protected reminderLeadTimeLabel(minutes: number): string {
		return `dashboard.bookingMessages.reminder.timingOptions.${minutes}`;
	}

	private settingsDiffer(a: BusinessConfirmationSettings, b: BusinessConfirmationSettings): boolean {
		return (
			a.message !== b.message ||
			a.locationInfo !== b.locationInfo ||
			a.googleMapsLink !== b.googleMapsLink ||
			a.enabled !== b.enabled ||
			a.includeLocationInfo !== b.includeLocationInfo ||
			a.includeTime !== b.includeTime ||
			a.includeBookingSlot !== b.includeBookingSlot ||
			a.reminderLeadTimeMinutes !== b.reminderLeadTimeMinutes
		);
	}

	private applyGoogleMapsLinkChange(
		value: string,
		locationSignal: { (): string; set(value: string): void },
		linkSignal: { set(value: string): void },
		lastAutoDerivedSignal: { (): string; set(value: string): void }
	): void {
		const previousAutoDerivedLocation = lastAutoDerivedSignal();
		const currentLocation = locationSignal().trim();
		const normalizedLink = normalizeGoogleMapsLink(value);
		const extractedLocation = extractAddressFromGoogleMapsLink(normalizedLink) ?? '';

		linkSignal.set(normalizedLink);

		if (!currentLocation || currentLocation === previousAutoDerivedLocation) {
			locationSignal.set(extractedLocation);
		}

		lastAutoDerivedSignal.set(extractedLocation);
	}

	private resetConfirmationDraft(settings: BusinessConfirmationSettings): void {
		this.confirmationMessage.set(settings.message);
		this.confirmationLocationInfo.set(settings.locationInfo);
		this.confirmationGoogleMapsLink.set(settings.googleMapsLink);
		this.confirmationEnabled.set(settings.enabled);
		this.confirmationIncludeLocationInfo.set(settings.includeLocationInfo);
		this.confirmationIncludeTime.set(settings.includeTime);
		this.confirmationIncludeBookingSlot.set(settings.includeBookingSlot);
		this.lastAutoDerivedConfirmationLocation.set(
			extractAddressFromGoogleMapsLink(settings.googleMapsLink) ?? ''
		);
	}

	private resetReminderDraft(settings: BusinessConfirmationSettings): void {
		this.reminderMessage.set(settings.message);
		this.reminderLocationInfo.set(settings.locationInfo);
		this.reminderGoogleMapsLink.set(settings.googleMapsLink);
		this.reminderEnabled.set(settings.enabled);
		this.reminderIncludeLocationInfo.set(settings.includeLocationInfo);
		this.reminderIncludeTime.set(settings.includeTime);
		this.reminderIncludeBookingSlot.set(settings.includeBookingSlot);
		this.reminderLeadTimeMinutes.set(settings.reminderLeadTimeMinutes);
		this.lastAutoDerivedReminderLocation.set(extractAddressFromGoogleMapsLink(settings.googleMapsLink) ?? '');
	}
}
