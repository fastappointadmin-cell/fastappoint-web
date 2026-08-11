export type DashboardWhatsAppSource = 'PROVISIONED' | 'OWN_NUMBER';

export type DashboardWhatsAppStatus = 'AWAITING_OTP' | 'ACTIVE' | 'FAILED' | 'DISCONNECTED';

export interface DashboardWhatsAppConnection {
	businessId: string;
	connected: boolean;
	source: DashboardWhatsAppSource | null;
	status: DashboardWhatsAppStatus | null;
	phoneNumber: string | null;
	waLink: string | null;
	failureReason: string | null;
	createdAt: string | null;
	updatedAt: string | null;
}

export interface DashboardStartWhatsAppConnectionRequest {
	source: DashboardWhatsAppSource;
	ownPhoneNumber?: string;
}

export interface DashboardSubmitWhatsAppOtpRequest {
	code: string;
}
