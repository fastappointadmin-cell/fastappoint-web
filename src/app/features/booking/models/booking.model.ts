import { BusinessConfirmationSettings } from '../../../core/models/business-confirmation-settings.model';

export interface PublicBusiness {
	id: string;
	name: string;
	slug: string;
	chatPhoneNumber?: string;
	description?: string;
}

export interface PublicService {
	id: string;
	businessId: string;
	name: string;
	durationSeconds: number;
	requirements: PublicServiceRequirement[];
}

export type PublicServiceRequirementFulfillmentMode = 'QUANTITY' | 'CAPACITY';

export interface PublicServiceRequirement {
	id: string;
	resourceTypeId: string;
	resourceTypeName: string;
	quantity: number;
	fulfillmentMode: PublicServiceRequirementFulfillmentMode;
	requiredCapacity: number | null;
	capacityInputKey: string | null;
}

export interface CreateBookingRequest {
	businessId: string;
	serviceId: string;
	startTime: string;
	customerName: string;
	customerPhone: string;
	inputs: Record<string, number>;
}

export interface BookingConfirmation {
	id: string;
	businessId: string;
	serviceId: string | null;
	serviceName: string | null;
	startTime: string;
	endTime: string;
	status: string;
	customerName: string;
	customerPhone: string;
	confirmationSettings: BusinessConfirmationSettings;
}

export interface ChatInboundMessageRequest {
	toPhoneNumber: string;
	fromPhoneNumber: string;
	customerName?: string;
	message: string;
}

export interface ChatAgentResponse {
	reply: string;
	nextAction?: string;
	matchedServiceName?: string;
}
