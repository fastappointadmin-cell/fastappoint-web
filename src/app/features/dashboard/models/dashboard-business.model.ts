import { BusinessConfirmationSettings } from '../../../core/models/business-confirmation-settings.model';
import { DashboardResource } from './dashboard-resource.model';
import { DashboardService } from './dashboard-service.model';

export interface DashboardBusiness {
	id: string;
	name: string;
	slug: string;
	description: string;
	confirmationSettings: BusinessConfirmationSettings;
	reminderSettings: BusinessConfirmationSettings;
	services: DashboardService[];
	resources: DashboardResource[];
}

export interface DashboardCreateBusinessRequest {
	name: string;
	confirmationSettings?: BusinessConfirmationSettings;
	reminderSettings?: BusinessConfirmationSettings;
}

export interface DashboardUpdateBusinessRequest {
	name: string;
	description?: string;
	confirmationSettings?: BusinessConfirmationSettings;
	reminderSettings?: BusinessConfirmationSettings;
}
