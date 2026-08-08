import {
	DashboardResourceAttributeDefinition,
	DashboardResourceAttributeValue,
	DashboardResourceAttributeValueInput,
	DashboardResourceAttributeType,
	DashboardServiceRequirementConstraint,
	DashboardServiceRequirementConstraintInput,
	DashboardServiceRequirementConstraintOperator
} from './dashboard-resource-attribute.model';

export const DASHBOARD_ATTRIBUTE_OPERATORS: Record<
	DashboardResourceAttributeType,
	DashboardServiceRequirementConstraintOperator[]
> = {
	TEXT: ['EQUALS', 'CONTAINS'],
	NUMBER: ['EQUALS', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN_OR_EQUAL'],
	BOOLEAN: ['EQUALS'],
	SINGLE_SELECT: ['EQUALS']
};

export function buildAttributeDraftMap(
	values: DashboardResourceAttributeValue[]
): Record<string, string> {
	return Object.fromEntries(
		values.map((value) => [value.attributeDefinitionId, value.value ?? ''])
	);
}

export function buildConstraintDrafts(
	constraints: DashboardServiceRequirementConstraint[]
): DashboardServiceRequirementConstraintInput[] {
	return constraints.map((constraint) => ({
		attributeDefinitionId: constraint.attributeDefinitionId,
		operator: constraint.operator,
		expectedValue: constraint.expectedValue
	}));
}

export function buildAttributeValueInputs(
	definitions: DashboardResourceAttributeDefinition[],
	drafts: Record<string, string>
): DashboardResourceAttributeValueInput[] {
	return definitions.map((definition) => ({
		attributeDefinitionId: definition.id,
		value: normalizeAttributeDraftValue(drafts[definition.id] ?? '')
	}));
}

export function getConstraintOperators(
	type: DashboardResourceAttributeType
): DashboardServiceRequirementConstraintOperator[] {
	return DASHBOARD_ATTRIBUTE_OPERATORS[type];
}

export function defaultConstraintForDefinition(
	definition: DashboardResourceAttributeDefinition
): DashboardServiceRequirementConstraintInput {
	return {
		attributeDefinitionId: definition.id,
		operator: getConstraintOperators(definition.type)[0],
		expectedValue: definition.type === 'BOOLEAN' ? 'true' : ''
	};
}

export function normalizeAttributeDraftValue(value: string | null | undefined): string | null {
	const normalized = (value ?? '').trim();
	return normalized.length > 0 ? normalized : null;
}
