import {
	DashboardCreateResourceAttributeDefinitionRequest,
	DashboardResourceAttributeDefinition,
	DashboardResourceAttributeValue,
	DashboardResourceAttributeValueInput,
	DashboardUpdateResourceAttributeDefinitionRequest
} from './dashboard-resource-attribute.model';

export interface DashboardResource {
	id: string;
	businessId: string;
	typeId: string;
	name: string;
	typeName: string;
	capacity: number | null;
	mergeGroup: string | null;
	attributeValues: DashboardResourceAttributeValue[];
}

export interface DashboardCreateResourceRequest {
	name: string;
	typeId: string;
	capacity: number | null;
	mergeGroup: string | null;
	attributeValues: DashboardResourceAttributeValueInput[];
}

export interface DashboardUpdateResourceRequest {
	name: string;
	typeId: string;
	capacity: number | null;
	mergeGroup: string | null;
	attributeValues: DashboardResourceAttributeValueInput[];
}

export interface DashboardResourceType {
	id: string;
	businessId: string;
	name: string;
	attributeDefinitions: DashboardResourceAttributeDefinition[];
}

export interface DashboardCreateResourceTypeRequest {
	name: string;
}

export interface DashboardUpdateResourceTypeRequest {
	name: string;
}

export type {
	DashboardCreateResourceAttributeDefinitionRequest,
	DashboardUpdateResourceAttributeDefinitionRequest
};
