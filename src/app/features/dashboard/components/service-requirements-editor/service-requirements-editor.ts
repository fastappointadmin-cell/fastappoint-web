import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  DashboardServiceRequirement,
  DashboardServiceRequirementFulfillmentMode,
  DashboardUpdateServiceRequirementRequest
} from '../../models/dashboard-service-requirement.model';
import { DashboardResourceType } from '../../models/dashboard-resource.model';
import { FilterPopover } from '../filter-popover/filter-popover';
import { DashboardEditDraftStore } from '../../data-access/dashboard-edit-draft-store';
import {
  buildConstraintDrafts,
  defaultConstraintForDefinition,
  getConstraintOperators
} from '../../models/dashboard-resource-attribute.helpers';
import {
  DashboardResourceAttributeDefinition,
  DashboardServiceRequirementConstraintInput,
  DashboardServiceRequirementConstraintOperator
} from '../../models/dashboard-resource-attribute.model';

@Component({
  selector: 'app-service-requirements-editor',
  imports: [FormsModule, FilterPopover, TranslocoPipe],
  templateUrl: './service-requirements-editor.html',
  styleUrl: './service-requirements-editor.scss',
})
export class ServiceRequirementsEditor {
  private readonly draftStore = inject(DashboardEditDraftStore);

  readonly serviceId = input.required<string>();
  readonly requirements = input.required<DashboardServiceRequirement[]>();
  readonly resourceTypes = input.required<DashboardResourceType[]>();

  readonly updateRequirement = output<{ requirementId: string; request: DashboardUpdateServiceRequirementRequest }>();
  readonly removeRequirement = output<string>();

  protected readonly selectedRequirementId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const requirementList = this.requirements();
      const selectedId = this.selectedRequirementId();

      if (!requirementList.length) {
        if (selectedId !== null) {
          this.selectedRequirementId.set(null);
        }
        return;
      }

      if (!selectedId || !requirementList.some((requirement) => requirement.id === selectedId)) {
        this.selectedRequirementId.set(requirementList[0].id);
      }
    });
  }

  protected getDraft(requirement: DashboardServiceRequirement): DashboardUpdateServiceRequirementRequest {
    const existingDraft = this.draftStore.getRequirementDrafts(this.serviceId())[requirement.id];
    if (existingDraft) {
      return {
        resourceTypeId: existingDraft.resourceTypeId,
        quantity: existingDraft.quantity,
        fulfillmentMode: existingDraft.fulfillmentMode ?? 'QUANTITY',
        requiredCapacity: existingDraft.requiredCapacity ?? null,
        capacityInputKey: existingDraft.capacityInputKey ?? null,
        constraints: existingDraft.constraints ?? []
      };
    }

    return {
      resourceTypeId: requirement.resourceTypeId,
      quantity: requirement.quantity,
      fulfillmentMode: requirement.fulfillmentMode ?? 'QUANTITY',
      requiredCapacity: requirement.requiredCapacity ?? null,
      capacityInputKey: requirement.capacityInputKey ?? null,
      constraints: buildConstraintDrafts(requirement.constraints)
    };
  }

  protected onDraftTypeChange(requirementId: string, resourceTypeId: string): void {
    const existingDraft = this.draftStore.getRequirementDrafts(this.serviceId())[requirementId];
    const nextConstraints = this.normalizeConstraintDraftsForType(
      resourceTypeId,
      existingDraft?.constraints ?? []
    );
    this.draftStore.setRequirementDraft(this.serviceId(), requirementId, {
      ...(existingDraft ?? { resourceTypeId: '', quantity: 1, fulfillmentMode: 'QUANTITY', requiredCapacity: null, capacityInputKey: null, constraints: [] }),
      resourceTypeId,
      constraints: nextConstraints
    });
  }

  protected onDraftFulfillmentModeChange(
    requirementId: string,
    fulfillmentMode: DashboardServiceRequirementFulfillmentMode
  ): void {
    const existingDraft = this.draftStore.getRequirementDrafts(this.serviceId())[requirementId];
    const nextDraft = {
    ...(existingDraft ?? {
      resourceTypeId: '',
      quantity: 1,
      fulfillmentMode: 'QUANTITY' as DashboardServiceRequirementFulfillmentMode,
      requiredCapacity: null,
      capacityInputKey: null,
      constraints: []
    }),
    fulfillmentMode
    };

    if (fulfillmentMode === 'QUANTITY') {
    nextDraft.quantity = Math.max(1, nextDraft.quantity ?? 1);
    } else if (nextDraft.requiredCapacity === null || nextDraft.requiredCapacity < 1) {
    nextDraft.requiredCapacity = 1;
    }

    this.draftStore.setRequirementDraft(this.serviceId(), requirementId, nextDraft);
  }

  protected onDraftQuantityChange(requirementId: string, quantity: number): void {
    const existingDraft = this.draftStore.getRequirementDrafts(this.serviceId())[requirementId];
    this.draftStore.setRequirementDraft(this.serviceId(), requirementId, {
    ...(existingDraft ?? { resourceTypeId: '', quantity: 1, fulfillmentMode: 'QUANTITY', requiredCapacity: null, capacityInputKey: null, constraints: [] }),
    quantity: Number.isFinite(quantity) ? quantity : 0
    });
  }

  protected onDraftRequiredCapacityChange(requirementId: string, requiredCapacity: number): void {
    const existingDraft = this.draftStore.getRequirementDrafts(this.serviceId())[requirementId];
    this.draftStore.setRequirementDraft(this.serviceId(), requirementId, {
    ...(existingDraft ?? { resourceTypeId: '', quantity: 1, fulfillmentMode: 'QUANTITY', requiredCapacity: null, capacityInputKey: null, constraints: [] }),
    requiredCapacity: Number.isFinite(requiredCapacity) ? requiredCapacity : null
    });
  }

  protected onDraftCapacityInputKeyChange(requirementId: string, capacityInputKey: string): void {
    const existingDraft = this.draftStore.getRequirementDrafts(this.serviceId())[requirementId];
    this.draftStore.setRequirementDraft(this.serviceId(), requirementId, {
    ...(existingDraft ?? { resourceTypeId: '', quantity: 1, fulfillmentMode: 'QUANTITY', requiredCapacity: null, capacityInputKey: null, constraints: [] }),
    capacityInputKey: capacityInputKey.trim() || null
    });
  }

  protected addConstraint(requirement: DashboardServiceRequirement): void {
    const draft = this.getDraft(requirement);
    const availableDefinitions = this.getDefinitionsForType(draft.resourceTypeId);
    const usedDefinitionIds = new Set(draft.constraints.map((constraint) => constraint.attributeDefinitionId));
    const nextDefinition = availableDefinitions.find((definition) => !usedDefinitionIds.has(definition.id));
    if (!nextDefinition) {
      return;
    }

    this.updateConstraintDrafts(requirement.id, draft.resourceTypeId, [
      ...draft.constraints,
      defaultConstraintForDefinition(nextDefinition)
    ]);
  }

  protected removeConstraint(requirement: DashboardServiceRequirement, constraintIndex: number): void {
    const draft = this.getDraft(requirement);
    this.updateConstraintDrafts(
      requirement.id,
      draft.resourceTypeId,
      draft.constraints.filter((_, index) => index !== constraintIndex)
    );
  }

  protected onConstraintDefinitionChange(
    requirement: DashboardServiceRequirement,
    constraintIndex: number,
    attributeDefinitionId: string
  ): void {
    const draft = this.getDraft(requirement);
    const definition = this.getDefinitionsForType(draft.resourceTypeId).find((item) => item.id === attributeDefinitionId);
    if (!definition) {
      return;
    }

    const nextConstraints = [...draft.constraints];
    nextConstraints[constraintIndex] = defaultConstraintForDefinition(definition);
    this.updateConstraintDrafts(requirement.id, draft.resourceTypeId, nextConstraints);
  }

  protected onConstraintOperatorChange(
    requirement: DashboardServiceRequirement,
    constraintIndex: number,
    operator: DashboardServiceRequirementConstraintOperator
  ): void {
    const draft = this.getDraft(requirement);
    const nextConstraints = [...draft.constraints];
    nextConstraints[constraintIndex] = {
      ...nextConstraints[constraintIndex],
      operator
    };
    this.updateConstraintDrafts(requirement.id, draft.resourceTypeId, nextConstraints);
  }

  protected onConstraintValueChange(
    requirement: DashboardServiceRequirement,
    constraintIndex: number,
    expectedValue: string
  ): void {
    const draft = this.getDraft(requirement);
    const nextConstraints = [...draft.constraints];
    nextConstraints[constraintIndex] = {
      ...nextConstraints[constraintIndex],
      expectedValue
    };
    this.updateConstraintDrafts(requirement.id, draft.resourceTypeId, nextConstraints);
  }

  protected saveRequirement(requirement: DashboardServiceRequirement): void {
    if (!this.canSaveRequirement(requirement)) {
      return;
    }

    const draft = this.getDraft(requirement);
    if (!draft.resourceTypeId || !this.isRequirementDraftValid(draft) || !this.areConstraintsValid(draft.resourceTypeId, draft.constraints)) {
      return;
    }

    this.updateRequirement.emit({
      requirementId: requirement.id,
      request: draft
    });

    this.draftStore.clearRequirementDraft(this.serviceId(), requirement.id);
  }

  protected deleteRequirement(requirementId: string): void {
    this.removeRequirement.emit(requirementId);
    if (this.selectedRequirementId() === requirementId) {
      const nextRequirement = this.requirements().find((requirement) => requirement.id !== requirementId) ?? null;
      this.selectedRequirementId.set(nextRequirement?.id ?? null);
    }
    this.draftStore.clearRequirementDraft(this.serviceId(), requirementId);
  }

  protected selectRequirement(requirementId: string): void {
    this.selectedRequirementId.set(requirementId);
  }

  protected activeRequirement(): DashboardServiceRequirement | null {
    const selectedId = this.selectedRequirementId();
    if (!selectedId) {
      return null;
    }

    return this.requirements().find((requirement) => requirement.id === selectedId) ?? null;
  }

  protected selectActiveRequirement(requirementId: string): void {
    this.selectRequirement(requirementId);
  }

  protected isRequirementDirty(requirement: DashboardServiceRequirement): boolean {
    const draft = this.getDraft(requirement);
    return (
      draft.resourceTypeId !== requirement.resourceTypeId ||
      draft.quantity !== requirement.quantity ||
      draft.fulfillmentMode !== requirement.fulfillmentMode ||
      draft.requiredCapacity !== requirement.requiredCapacity ||
      (draft.capacityInputKey ?? null) !== requirement.capacityInputKey ||
      JSON.stringify(draft.constraints) !== JSON.stringify(buildConstraintDrafts(requirement.constraints))
    );
  }

  protected canSaveRequirement(requirement: DashboardServiceRequirement): boolean {
    if (!this.isRequirementDirty(requirement)) {
      return false;
    }

    const draft = this.getDraft(requirement);
    return draft.resourceTypeId.length > 0
      && this.isRequirementDraftValid(draft)
      && this.areConstraintsValid(draft.resourceTypeId, draft.constraints);
  }

  protected discardRequirementDraft(requirement: DashboardServiceRequirement): void {
    this.draftStore.clearRequirementDraft(this.serviceId(), requirement.id);
  }

  protected hasUnsavedRequirementDraft(requirement: DashboardServiceRequirement): boolean {
    const draft = this.draftStore.getRequirementDrafts(this.serviceId())[requirement.id];
      if (!draft) {
        return false;
      }

      return (
        draft.resourceTypeId !== requirement.resourceTypeId ||
        draft.quantity !== requirement.quantity ||
        draft.fulfillmentMode !== requirement.fulfillmentMode ||
        draft.requiredCapacity !== requirement.requiredCapacity ||
        (draft.capacityInputKey ?? null) !== requirement.capacityInputKey ||
        JSON.stringify(draft.constraints) !== JSON.stringify(buildConstraintDrafts(requirement.constraints))
      );
  }

  protected constraintsForRequirement(requirement: DashboardServiceRequirement): DashboardServiceRequirementConstraintInput[] {
    return this.getDraft(requirement).constraints;
  }

  protected definitionsForRequirement(requirement: DashboardServiceRequirement): DashboardResourceAttributeDefinition[] {
    return this.getDefinitionsForType(this.getDraft(requirement).resourceTypeId);
  }

  protected definitionForConstraint(
    requirement: DashboardServiceRequirement,
    attributeDefinitionId: string
  ): DashboardResourceAttributeDefinition | null {
    return this.definitionsForRequirement(requirement).find((definition) => definition.id === attributeDefinitionId) ?? null;
  }

  protected operatorsForDefinition(definition: DashboardResourceAttributeDefinition): DashboardServiceRequirementConstraintOperator[] {
    return getConstraintOperators(definition.type);
  }

  private updateConstraintDrafts(
    requirementId: string,
    resourceTypeId: string,
    constraints: DashboardServiceRequirementConstraintInput[]
  ): void {
    const existingDraft = this.draftStore.getRequirementDrafts(this.serviceId())[requirementId];
    this.draftStore.setRequirementDraft(this.serviceId(), requirementId, {
      ...(existingDraft ?? { resourceTypeId, quantity: 1, fulfillmentMode: 'QUANTITY', requiredCapacity: null, capacityInputKey: null, constraints: [] }),
      resourceTypeId,
      constraints: this.normalizeConstraintDraftsForType(resourceTypeId, constraints)
    });
  }

  private isRequirementDraftValid(draft: DashboardUpdateServiceRequirementRequest): boolean {
    if (draft.fulfillmentMode === 'CAPACITY') {
      const hasCapacity = draft.requiredCapacity !== null && draft.requiredCapacity >= 1;
      const hasInputKey = (draft.capacityInputKey ?? '').trim().length > 0;
      return hasCapacity || hasInputKey;
    }
    return draft.quantity >= 1;
  }

  private getDefinitionsForType(resourceTypeId: string): DashboardResourceAttributeDefinition[] {
    return this.resourceTypes().find((resourceType) => resourceType.id === resourceTypeId)?.attributeDefinitions ?? [];
  }

  private normalizeConstraintDraftsForType(
    resourceTypeId: string,
    constraints: DashboardServiceRequirementConstraintInput[]
  ): DashboardServiceRequirementConstraintInput[] {
    const definitionsById = new Map(
      this.getDefinitionsForType(resourceTypeId).map((definition) => [definition.id, definition])
    );
    const seenDefinitionIds = new Set<string>();
    const normalizedConstraints: DashboardServiceRequirementConstraintInput[] = [];

    for (const constraint of constraints) {
      const definition = definitionsById.get(constraint.attributeDefinitionId);
      if (!definition || seenDefinitionIds.has(definition.id)) {
        continue;
      }

      const operators = getConstraintOperators(definition.type);
      normalizedConstraints.push({
        attributeDefinitionId: definition.id,
        operator: operators.includes(constraint.operator) ? constraint.operator : operators[0],
        expectedValue:
          definition.type === 'BOOLEAN'
            ? constraint.expectedValue || 'true'
            : constraint.expectedValue
      });
      seenDefinitionIds.add(definition.id);
    }

    return normalizedConstraints;
  }

  private areConstraintsValid(
    resourceTypeId: string,
    constraints: DashboardServiceRequirementConstraintInput[]
  ): boolean {
    const definitionsById = new Map(
      this.getDefinitionsForType(resourceTypeId).map((definition) => [definition.id, definition])
    );
    const seenDefinitionIds = new Set<string>();

    return constraints.every((constraint) => {
      const definition = definitionsById.get(constraint.attributeDefinitionId);
      if (!definition || seenDefinitionIds.has(definition.id)) {
        return false;
      }

      seenDefinitionIds.add(definition.id);
      if (!getConstraintOperators(definition.type).includes(constraint.operator)) {
        return false;
      }

      return definition.type === 'BOOLEAN'
        ? constraint.expectedValue === 'true' || constraint.expectedValue === 'false'
        : constraint.expectedValue.trim().length > 0;
    });
  }

}
