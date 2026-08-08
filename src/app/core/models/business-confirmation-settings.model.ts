export interface BusinessConfirmationSettings {
	message: string;
	locationInfo: string;
	googleMapsLink: string;
	enabled: boolean;
	includeLocationInfo: boolean;
	includeTime: boolean;
	includeBookingSlot: boolean;
	reminderLeadTimeMinutes: number;
}

export function createDefaultBusinessConfirmationSettings(): BusinessConfirmationSettings {
	return {
		message: '',
		locationInfo: '',
		googleMapsLink: '',
		enabled: true,
		includeLocationInfo: false,
		includeTime: true,
		includeBookingSlot: true,
		reminderLeadTimeMinutes: 1440
	};
}

export function normalizeBusinessConfirmationSettings(
	settings: Partial<BusinessConfirmationSettings> | null | undefined
): BusinessConfirmationSettings {
	const defaults = createDefaultBusinessConfirmationSettings();
	return {
		message: settings?.message?.trim() ?? defaults.message,
		locationInfo: settings?.locationInfo?.trim() ?? defaults.locationInfo,
		googleMapsLink: settings?.googleMapsLink?.trim() ?? defaults.googleMapsLink,
		enabled: settings?.enabled ?? defaults.enabled,
		includeLocationInfo: settings?.includeLocationInfo ?? defaults.includeLocationInfo,
		includeTime: settings?.includeTime ?? defaults.includeTime,
		includeBookingSlot: settings?.includeBookingSlot ?? defaults.includeBookingSlot,
		reminderLeadTimeMinutes:
			typeof settings?.reminderLeadTimeMinutes === 'number' && settings.reminderLeadTimeMinutes >= 5
				? settings.reminderLeadTimeMinutes
				: defaults.reminderLeadTimeMinutes
	};
}
