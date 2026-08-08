export type DashboardResourceAttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SINGLE_SELECT';

export type DashboardServiceRequirementConstraintOperator =
	| 'EQUALS'
	| 'CONTAINS'
	| 'GREATER_THAN_OR_EQUAL'
	| 'LESS_THAN_OR_EQUAL';

export interface DashboardResourceAttributeDefinition {
	id: string;
	resourceTypeId: string;
	name: string;
	type: DashboardResourceAttributeType;
	required: boolean;
	options: string[];
}

export interface DashboardResourceAttributeValue {
	attributeDefinitionId: string;
	attributeName: string;
	attributeType: DashboardResourceAttributeType;
	required: boolean;
	options: string[];
	value: string | null;
}

export interface DashboardResourceAttributeValueInput {
	attributeDefinitionId: string;
	value: string | null;
}

export interface DashboardServiceRequirementConstraint {
	id: string;
	attributeDefinitionId: string;
	attributeName: string;
	attributeType: DashboardResourceAttributeType;
	operator: DashboardServiceRequirementConstraintOperator;
	expectedValue: string;
	options: string[];
}

export interface DashboardServiceRequirementConstraintInput {
	attributeDefinitionId: string;
	operator: DashboardServiceRequirementConstraintOperator;
	expectedValue: string;
}

export interface DashboardCreateResourceAttributeDefinitionRequest {
	name: string;
	type: DashboardResourceAttributeType;
	required: boolean;
	options: string[];
}

export interface DashboardUpdateResourceAttributeDefinitionRequest {
	name: string;
	type: DashboardResourceAttributeType;
	required: boolean;
	options: string[];
}
