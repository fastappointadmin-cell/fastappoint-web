import {
	DashboardServiceRequirementConstraint,
	DashboardServiceRequirementConstraintInput
} from './dashboard-resource-attribute.model';

export type DashboardServiceRequirementFulfillmentMode = 'QUANTITY' | 'CAPACITY';

export interface DashboardServiceRequirement {
	id: string;
	serviceId: string;
	resourceTypeId: string;
	resourceTypeName: string;
	quantity: number;
	fulfillmentMode: DashboardServiceRequirementFulfillmentMode;
	requiredCapacity: number | null;
	capacityInputKey: string | null;
	constraints: DashboardServiceRequirementConstraint[];
}

export interface DashboardAddServiceRequirementRequest {
	resourceTypeId: string;
	quantity: number;
	fulfillmentMode: DashboardServiceRequirementFulfillmentMode;
	requiredCapacity: number | null;
	capacityInputKey: string | null;
	constraints: DashboardServiceRequirementConstraintInput[];
}

export interface DashboardUpdateServiceRequirementRequest {
	resourceTypeId: string;
	quantity: number;
	fulfillmentMode: DashboardServiceRequirementFulfillmentMode;
	requiredCapacity: number | null;
	capacityInputKey: string | null;
	constraints: DashboardServiceRequirementConstraintInput[];
}
