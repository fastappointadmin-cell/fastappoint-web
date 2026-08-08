import { DashboardServiceRequirement } from './dashboard-service-requirement.model';

export interface DashboardService {
	id: string;
	businessId: string;
	name: string;
	durationSeconds: number;
	requirements: DashboardServiceRequirement[];
}

export interface DashboardCreateServiceRequest {
	name: string;
	durationSeconds: number;
}

export interface DashboardUpdateServiceRequest {
	name: string;
	durationSeconds: number | null;
}
