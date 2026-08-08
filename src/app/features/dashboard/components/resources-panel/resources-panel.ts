import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  DashboardCreateResourceAttributeDefinitionRequest,
  DashboardCreateResourceRequest,
  DashboardCreateResourceTypeRequest,
  DashboardResource,
  DashboardResourceType,
  DashboardUpdateResourceRequest,
  DashboardUpdateResourceAttributeDefinitionRequest,
  DashboardUpdateResourceTypeRequest
} from '../../models/dashboard-resource.model';
import { DashboardService } from '../../models/dashboard-service.model';
import { ResourceCreateDialog } from '../resource-create-dialog/resource-create-dialog.entry';
import { FixedSlotsListComponent } from '../fixed-slots-list/fixed-slots-list';
import { FilterPopover } from '../filter-popover/filter-popover';
import { ResourceTypeCreateDialog } from '../resource-type-create-dialog/resource-type-create-dialog.entry';
import { EditPanelComponent } from '../edit-panel/edit-panel';
import { DashboardEditDraftStore } from '../../data-access/dashboard-edit-draft-store';
import { ResourceAvailabilityPanel } from '../resource-availability-panel/resource-availability-panel';
import {
  buildAttributeDraftMap,
  buildAttributeValueInputs
} from '../../models/dashboard-resource-attribute.helpers';
import { DashboardResourceAttributeType } from '../../models/dashboard-resource-attribute.model';

@Component({
  selector: 'app-resources-panel',
  imports: [FormsModule, FixedSlotsListComponent, FilterPopover, EditPanelComponent, ResourceAvailabilityPanel, TranslocoPipe],
  templateUrl: './resources-panel.html',
  styleUrl: './resources-panel.scss'
})
export class ResourcesPanel {
  private readonly dialog = inject(Dialog);
  private readonly draftStore = inject(DashboardEditDraftStore);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });
  /** 1, nu 2: pe ecrane foarte mici, capacitatea reală măsurată poate fi doar 1 rând -- forțarea unui minim de
   * 2 ar însemna să arătăm mai multe rânduri decât încap cu adevărat, exact bug-ul pe care capacitatea
   * măsurată din DOM trebuia să-l elimine. */
  private readonly minPageSize = 1;
  private readonly maxPageSize = 12;

  readonly resources = input.required<DashboardResource[]>();
  readonly services = input.required<DashboardService[]>();
  readonly resourceTypes = input.required<DashboardResourceType[]>();

  readonly createResource = output<DashboardCreateResourceRequest>();
  readonly updateResource = output<{ resourceId: string; request: DashboardUpdateResourceRequest }>();
  readonly createResourceType = output<DashboardCreateResourceTypeRequest>();
  readonly updateResourceType = output<{ resourceTypeId: string; request: DashboardUpdateResourceTypeRequest }>();
  readonly removeResourceType = output<string>();
  readonly createResourceAttributeDefinition =
    output<{ resourceTypeId: string; request: DashboardCreateResourceAttributeDefinitionRequest }>();
  readonly updateResourceAttributeDefinition =
    output<{ resourceTypeId: string; attributeDefinitionId: string; request: DashboardUpdateResourceAttributeDefinitionRequest }>();
  readonly removeResourceAttributeDefinition = output<{ resourceTypeId: string; attributeDefinitionId: string }>();

  protected readonly selectedResourceTypeId = signal<string | null>(null);
  protected readonly inlineEditingResourceTypeId = signal<string | null>(null);
  protected readonly inlineResourceTypeName = signal('');
  protected readonly resourceTypeSearchQuery = signal('');
  protected readonly resourceTypeUsageFilter = signal<'all' | 'used' | 'unused'>('all');
  protected readonly resourceTypePageIndex = signal(0);

  protected readonly selectedResourceId = signal<string | null>(null);
  protected readonly resourceSearchQuery = signal('');
  protected readonly resourceTypeFilter = signal<string>('all');
  protected readonly resourceCapacityOperator = signal<'any' | 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between'>('any');
  protected readonly resourceCapacityValue = signal<string>('');
  protected readonly resourceCapacityValueMax = signal<string>('');
  protected readonly resourceNameDraft = signal('');
  protected readonly resourceTypeDraft = signal('');
  protected readonly resourceCapacityDraft = signal<number | null>(null);
  protected readonly resourceCombinationEnabled = signal(false);
  protected readonly resourceMergeGroupDraft = signal<string | null>(null);
  protected readonly resourceAttributeDrafts = signal<Record<string, string>>({});
  protected readonly hydratedResourceId = signal<string | null>(null);
  protected readonly resourcePageIndex = signal(0);
  protected readonly editingAttributeDefinitionId = signal<string | null>(null);
  protected readonly attributeDefinitionNameDraft = signal('');
  protected readonly attributeDefinitionTypeDraft = signal<DashboardResourceAttributeType>('TEXT');
  protected readonly attributeDefinitionRequiredDraft = signal(false);
  protected readonly attributeDefinitionOptionsDraft = signal('');
  protected readonly newAttributeDefinitionName = signal('');
  protected readonly newAttributeDefinitionType = signal<DashboardResourceAttributeType>('TEXT');
  protected readonly newAttributeDefinitionRequired = signal(false);
  protected readonly newAttributeDefinitionOptions = signal('');
  protected readonly attributeTypeOptions: DashboardResourceAttributeType[] = ['TEXT', 'NUMBER', 'BOOLEAN', 'SINGLE_SELECT'];

  /** Câte rânduri încap efectiv, măsurat direct din DOM de fiecare `app-fixed-slots-list` (vezi capacityChange). */
  protected readonly resourceTypesCapacity = signal(this.minPageSize);
  protected readonly resourcesCapacity = signal(this.minPageSize);

  protected readonly filteredResourceTypes = computed(() => {
    const query = this.resourceTypeSearchQuery().trim().toLowerCase();
    const usageFilter = this.resourceTypeUsageFilter();

    return this.resourceTypes().filter((resourceType) => {
      const matchesSearch = !query || resourceType.name.toLowerCase().includes(query);
      const usedByResources = this.resources().some((resource) => resource.typeId === resourceType.id);

      const matchesUsage =
        usageFilter === 'all' ||
        (usageFilter === 'used' && usedByResources) ||
        (usageFilter === 'unused' && !usedByResources);

      return matchesSearch && matchesUsage;
    });
  });

  protected readonly filteredResources = computed(() => {
    const query = this.resourceSearchQuery().trim().toLowerCase();
    const typeFilter = this.resourceTypeFilter();
    const capacityOperator = this.resourceCapacityOperator();
    const capacityValue = this.parseFilterNumber(this.resourceCapacityValue());
    const capacityValueMax = this.parseFilterNumber(this.resourceCapacityValueMax());

    return this.resources().filter((resource) => {
      const capacityLabel = resource.capacity === null ? '' : String(resource.capacity);
      const matchesSearch =
        !query ||
        resource.name.toLowerCase().includes(query) ||
        resource.typeName.toLowerCase().includes(query) ||
        capacityLabel.includes(query);

      const matchesType = typeFilter === 'all' || resource.typeId === typeFilter;
      const matchesCapacity = this.matchesNumberFilter(
        resource.capacity,
        capacityOperator,
        capacityValue,
        capacityValueMax
      );

      return matchesSearch && matchesType && matchesCapacity;
    });
  });

  protected readonly resourceTypePageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredResourceTypes().length / this.resourceTypesCapacity()))
  );
  protected readonly resourcePageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredResources().length / this.resourcesCapacity()))
  );

  protected readonly pagedResourceTypes = computed(() => {
    const pageSize = this.resourceTypesCapacity();
    const start = this.resourceTypePageIndex() * pageSize;
    return this.filteredResourceTypes().slice(start, start + pageSize);
  });

  protected readonly resourceTypePlaceholderSlots = computed(() => {
    const missingSlots = this.resourceTypesCapacity() - this.pagedResourceTypes().length;
    return Array.from({ length: Math.max(0, missingSlots) }, (_, index) => index);
  });

  protected readonly pagedResources = computed(() => {
    const pageSize = this.resourcesCapacity();
    const start = this.resourcePageIndex() * pageSize;
    return this.filteredResources().slice(start, start + pageSize);
  });

  protected readonly resourcePlaceholderSlots = computed(() => {
    const missingSlots = this.resourcesCapacity() - this.pagedResources().length;
    return Array.from({ length: Math.max(0, missingSlots) }, (_, index) => index);
  });

  protected readonly hasResourceChanges = computed(() => {
    const resource = this.activeResource();
    if (!resource) {
      return false;
    }

    const draftName = this.resourceNameDraft().trim();
    const draftTypeId = this.resourceTypeDraft();
    const draftCapacity = this.resourceCapacityDraft();
    const draftMergeGroup = this.effectiveResourceMergeGroup();

    return (
      draftName !== resource.name ||
      draftTypeId !== resource.typeId ||
      draftCapacity !== resource.capacity ||
      draftMergeGroup !== resource.mergeGroup
    );
  });

  protected readonly canSaveResourceChanges = computed(() => {
    if (!this.hasResourceChanges()) {
      return false;
    }

    const draftName = this.resourceNameDraft().trim();
    const draftTypeId = this.resourceTypeDraft();
    const draftType = this.resourceTypes().find((resourceType) => resourceType.id === draftTypeId) ?? null;
    return draftName.length > 0 && draftTypeId.length > 0 && this.resourceAttributesValid(draftType);
  });

  protected readonly activeDraftResourceType = computed(
    () => this.resourceTypes().find((resourceType) => resourceType.id === this.resourceTypeDraft()) ?? null
  );
  protected readonly effectiveResourceMergeGroup = computed(() =>
    this.resourceCombinationEnabled() ? this.resourceMergeGroupDraft() : null
  );

  constructor() {
    effect(() => {
      const types = this.resourceTypes();
      const selectedId = this.selectedResourceTypeId();

      if (!types.length) {
        // Keep the current selection during transient reload gaps.
        return;
      }

      if (!selectedId || !types.some((resourceType) => resourceType.id === selectedId)) {
        this.selectedResourceTypeId.set(types[0].id);
      }

      const maxPage = Math.max(0, this.resourceTypePageCount() - 1);
      if (this.resourceTypePageIndex() > maxPage) {
        this.resourceTypePageIndex.set(maxPage);
      }
    });

    effect(() => {
      const editingId = this.inlineEditingResourceTypeId();
      if (!editingId) {
        return;
      }

      const editedType = this.resourceTypes().find((resourceType) => resourceType.id === editingId);
      if (!editedType) {
        this.inlineEditingResourceTypeId.set(null);
        this.inlineResourceTypeName.set('');
      }
    });

    effect(() => {
      const allResources = this.resources();
      const selectedId = this.selectedResourceId();

      if (!allResources.length) {
        // Keep the current selection during transient reload gaps.
        return;
      }

      if (!selectedId || !allResources.some((resource) => resource.id === selectedId)) {
        this.selectedResourceId.set(allResources[0].id);
      }

      const maxPage = Math.max(0, this.resourcePageCount() - 1);
      if (this.resourcePageIndex() > maxPage) {
        this.resourcePageIndex.set(maxPage);
      }
    });

    effect(() => {
      const selectedTypeId = this.selectedResourceTypeId();
      if (!selectedTypeId) {
        return;
      }

      const index = this.filteredResourceTypes().findIndex((resourceType) => resourceType.id === selectedTypeId);
      if (index < 0) {
        return;
      }

      this.resourceTypePageIndex.set(Math.floor(index / this.resourceTypesCapacity()));
    });

    effect(() => {
      const selectedResourceId = this.selectedResourceId();
      if (!selectedResourceId) {
        return;
      }

      const index = this.filteredResources().findIndex((resource) => resource.id === selectedResourceId);
      if (index < 0) {
        return;
      }

      this.resourcePageIndex.set(Math.floor(index / this.resourcesCapacity()));
    });

    effect(() => {
      const activeResource = this.activeResource();
      const hydratedId = this.hydratedResourceId();

      if (!activeResource) {
        this.hydratedResourceId.set(null);
        return;
      }

      if (hydratedId === activeResource.id) {
        if (!this.draftStore.getResourceDraft(activeResource.id)) {
          this.resourceNameDraft.set(activeResource.name);
          this.resourceTypeDraft.set(activeResource.typeId);
          this.resourceCapacityDraft.set(activeResource.capacity);
          this.resourceMergeGroupDraft.set(activeResource.mergeGroup);
          this.resourceCombinationEnabled.set(activeResource.mergeGroup !== null);
        }
        return;
      }

      const persistedDraft = this.draftStore.getResourceDraft(activeResource.id);
      this.resourceNameDraft.set(persistedDraft?.name ?? activeResource.name);
      this.resourceTypeDraft.set(persistedDraft?.typeId ?? activeResource.typeId);
      this.resourceCapacityDraft.set(persistedDraft?.capacity ?? activeResource.capacity);
      const persistedMergeGroup = persistedDraft?.mergeGroup ?? activeResource.mergeGroup;
      this.resourceMergeGroupDraft.set(persistedMergeGroup);
      this.resourceCombinationEnabled.set(persistedMergeGroup !== null);
      this.resourceAttributeDrafts.set(
        persistedDraft?.attributeValues ?? buildAttributeDraftMap(activeResource.attributeValues)
      );
      this.hydratedResourceId.set(activeResource.id);
    });

    effect(() => {
      const activeResource = this.activeResource();
      if (!activeResource) {
        return;
      }

      if (this.hydratedResourceId() !== activeResource.id) {
        return;
      }

      const draftName = this.resourceNameDraft().trim();
      const draftTypeId = this.resourceTypeDraft();
      const draftCapacity = this.resourceCapacityDraft();
      const draftMergeGroup = this.effectiveResourceMergeGroup();
      const draftAttributes = this.resourceAttributeDrafts();
      const isDirty =
        draftName !== activeResource.name ||
        draftTypeId !== activeResource.typeId ||
        draftCapacity !== activeResource.capacity ||
        draftMergeGroup !== activeResource.mergeGroup ||
        JSON.stringify(draftAttributes) !== JSON.stringify(buildAttributeDraftMap(activeResource.attributeValues));

      if (!isDirty) {
        this.draftStore.clearResourceDraft(activeResource.id);
        return;
      }

      this.draftStore.setResourceDraft(activeResource.id, {
        name: this.resourceNameDraft(),
        typeId: draftTypeId,
        capacity: draftCapacity,
        mergeGroup: draftMergeGroup,
        attributeValues: draftAttributes
      });
    });
  }

  protected openCreateResourceTypeDialog(): void {
    const dialogRef = this.dialog.open(ResourceTypeCreateDialog, {
      width: '460px',
      maxWidth: '92vw',
      panelClass: 'app-ui-dialog-panel',
      backdropClass: 'app-ui-dialog-backdrop'
    });

    dialogRef.closed.subscribe((result) => {
      const request = result as DashboardCreateResourceTypeRequest | null | undefined;
      if (request) {
        this.createResourceType.emit(request);
      }
    });
  }

  /** Capacitatea reală (câte rânduri încap), raportată de `app-fixed-slots-list` via ResizeObserver. */
  protected onResourceTypesCapacity(capacity: number): void {
    this.resourceTypesCapacity.set(Math.max(this.minPageSize, Math.min(this.maxPageSize, capacity)));
  }

  protected onResourcesCapacity(capacity: number): void {
    this.resourcesCapacity.set(Math.max(this.minPageSize, Math.min(this.maxPageSize, capacity)));
  }

  protected openCreateResourceDialog(): void {
    const dialogRef = this.dialog.open(ResourceCreateDialog, {
      width: '520px',
      maxWidth: '92vw',
      panelClass: 'app-ui-dialog-panel',
      backdropClass: 'app-ui-dialog-backdrop',
      data: {
        resourceTypes: this.resourceTypes()
      }
    });

    dialogRef.closed.subscribe((result) => {
      const request = result as DashboardCreateResourceRequest | null | undefined;
      if (request) {
        this.createResource.emit(request);
      }
    });
  }

  protected setResourceCapacityDraft(value: string | number | null): void {
    if (value === null || value === '') {
      this.resourceCapacityDraft.set(null);
      return;
    }

    const parsedValue = Number(value);
    this.resourceCapacityDraft.set(Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null);
  }

  protected onResourceTypeDraftChange(typeId: string): void {
    this.resourceTypeDraft.set(typeId);
    const nextType = this.resourceTypes().find((resourceType) => resourceType.id === typeId) ?? null;
    this.resourceAttributeDrafts.update((currentDrafts) =>
      Object.fromEntries(
        (nextType?.attributeDefinitions ?? []).map((definition) => [definition.id, currentDrafts[definition.id] ?? ''])
      )
    );
  }

  protected resourceAttributeDraft(attributeDefinitionId: string): string {
    return this.resourceAttributeDrafts()[attributeDefinitionId] ?? '';
  }

  protected setResourceAttributeDraft(attributeDefinitionId: string, value: string): void {
    this.resourceAttributeDrafts.update((currentDrafts) => ({
      ...currentDrafts,
      [attributeDefinitionId]: value
    }));
  }

  protected setResourceMergeGroupDraft(value: string | null): void {
    const normalized = typeof value === 'string' ? value.trim() : '';
    this.resourceMergeGroupDraft.set(normalized || null);
  }

  protected setResourceCombinationEnabled(value: boolean): void {
    this.resourceCombinationEnabled.set(value);
  }

  protected setResourceTypeSearchQuery(value: string): void {
    this.resourceTypeSearchQuery.set(value);
    this.resourceTypePageIndex.set(0);
  }

  protected setResourceTypeUsageFilter(value: 'all' | 'used' | 'unused'): void {
    this.resourceTypeUsageFilter.set(value);
    this.resourceTypePageIndex.set(0);
  }

  protected clearResourceTypeFilters(): void {
    this.setResourceTypeUsageFilter('all');
  }

  protected setResourceSearchQuery(value: string): void {
    this.resourceSearchQuery.set(value);
    this.resourcePageIndex.set(0);
  }

  protected setResourceTypeFilter(value: string): void {
    this.resourceTypeFilter.set(value);
    this.resourcePageIndex.set(0);
  }

  protected setResourceCapacityOperator(value: 'any' | 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between'): void {
    this.resourceCapacityOperator.set(value);
    this.resourcePageIndex.set(0);
  }

  protected setResourceCapacityValue(value: string): void {
    this.resourceCapacityValue.set(value);
    this.resourcePageIndex.set(0);
  }

  protected setResourceCapacityValueMax(value: string): void {
    this.resourceCapacityValueMax.set(value);
    this.resourcePageIndex.set(0);
  }

  protected clearResourceFilters(): void {
    this.setResourceTypeFilter('all');
    this.setResourceCapacityOperator('any');
    this.setResourceCapacityValue('');
    this.setResourceCapacityValueMax('');
  }

  private parseFilterNumber(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsedValue = Number(trimmed);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  private matchesNumberFilter(
    value: number | null,
    operator: 'any' | 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between',
    primary: number | null,
    secondary: number | null
  ): boolean {
    if (operator === 'any') {
      return true;
    }

    if (value === null || primary === null) {
      return false;
    }

    switch (operator) {
      case 'lt':
        return value < primary;
      case 'lte':
        return value <= primary;
      case 'eq':
        return value === primary;
      case 'gte':
        return value >= primary;
      case 'gt':
        return value > primary;
      case 'between': {
        if (secondary === null) {
          return false;
        }

        const minValue = Math.min(primary, secondary);
        const maxValue = Math.max(primary, secondary);
        return value >= minValue && value <= maxValue;
      }
      default:
        return true;
    }
  }

  protected selectResourceType(resourceTypeId: string): void {
    this.selectedResourceTypeId.set(resourceTypeId);
  }

  protected restoreSelectedResourceType(resourceTypeId: string | null): void {
    if (!resourceTypeId) {
      return;
    }

    this.selectedResourceTypeId.set(resourceTypeId);
  }

  protected activeResourceType(): DashboardResourceType | null {
    const selectedId = this.selectedResourceTypeId();
    if (!selectedId) {
      return null;
    }

    return this.resourceTypes().find((resourceType) => resourceType.id === selectedId) ?? null;
  }

  protected saveResourceType(): void {
    const activeType = this.activeResourceType();
    if (!activeType) {
      return;
    }

    this.startInlineTypeEdit(activeType.id, activeType.name);
  }

  protected deleteResourceType(): void {
    const activeType = this.activeResourceType();
    if (!activeType) {
      return;
    }

    this.removeResourceType.emit(activeType.id);
    this.selectedResourceTypeId.set(null);
    this.inlineEditingResourceTypeId.set(null);
    this.inlineResourceTypeName.set('');
  }

  protected deleteResourceTypeById(resourceTypeId: string): void {
    this.selectResourceType(resourceTypeId);
    this.deleteResourceType();
  }

  protected selectResource(resourceId: string): void {
    this.selectedResourceId.set(resourceId);
  }

  protected restoreSelectedResource(resourceId: string | null): void {
    if (!resourceId) {
      return;
    }

    this.selectedResourceId.set(resourceId);
  }

  protected activeResource(): DashboardResource | null {
    const selectedId = this.selectedResourceId();
    if (!selectedId) {
      return null;
    }

    return this.resources().find((resource) => resource.id === selectedId) ?? null;
  }

  /** Pre-resolved (not translation keys) since they interpolate live data -- edit-panel just displays
   * whatever string it's handed. Depending on activeLang() keeps them re-computing on a language switch
   * even though the underlying resource data hasn't changed. */
  protected readonly activeResourcePanelTitle = computed(() => {
    this.activeLang();
    const resource = this.activeResource();
    return resource ? this.transloco.translate('dashboard.resources.form.editingTitle', { name: resource.name }) : '';
  });
  protected readonly activeResourcePanelSubtitle = computed(() => {
    this.activeLang();
    const resource = this.activeResource();
    return resource ? this.transloco.translate('dashboard.resources.form.currentTypeSubtitle', { type: resource.typeName }) : '';
  });

  protected saveResource(): void {
    if (!this.canSaveResourceChanges()) {
      return;
    }

    const resource = this.activeResource();
    if (!resource) {
      return;
    }

    const trimmedName = this.resourceNameDraft().trim();
    const selectedTypeId = this.resourceTypeDraft();
    const submittedCapacity = this.resourceCapacityDraft();
    const submittedMergeGroup = this.effectiveResourceMergeGroup();
    const draftType = this.activeDraftResourceType();
    if (!trimmedName || !selectedTypeId) {
      return;
    }

    this.updateResource.emit({
      resourceId: resource.id,
      request: {
        name: trimmedName,
        typeId: selectedTypeId,
        capacity: submittedCapacity,
        mergeGroup: submittedMergeGroup,
        attributeValues: buildAttributeValueInputs(
          draftType?.attributeDefinitions ?? [],
          this.resourceAttributeDrafts()
        )
      }
    });

    this.draftStore.clearResourceDraft(resource.id);
    this.resourceNameDraft.set(trimmedName);
    this.resourceTypeDraft.set(selectedTypeId);
    this.resourceCapacityDraft.set(submittedCapacity);
    this.resourceCombinationEnabled.set(submittedMergeGroup !== null);
    this.resourceMergeGroupDraft.set(submittedMergeGroup);
    this.resourceAttributeDrafts.set(
      Object.fromEntries(
        (draftType?.attributeDefinitions ?? []).map((definition) => [
          definition.id,
          this.resourceAttributeDraft(definition.id)
        ])
      )
    );
  }

  protected discardResourceEdits(): void {
    const activeResource = this.activeResource();
    if (!activeResource) {
      return;
    }

    this.resourceNameDraft.set(activeResource.name);
    this.resourceTypeDraft.set(activeResource.typeId);
    this.resourceCapacityDraft.set(activeResource.capacity);
    this.resourceCombinationEnabled.set(activeResource.mergeGroup !== null);
    this.resourceMergeGroupDraft.set(activeResource.mergeGroup);
    this.resourceAttributeDrafts.set(buildAttributeDraftMap(activeResource.attributeValues));
    this.draftStore.clearResourceDraft(activeResource.id);
  }

  protected resourceHasPendingEdits(resourceId: string): boolean {
    const resource = this.resources().find((item) => item.id === resourceId);
    if (!resource) {
      return false;
    }

    const draft = this.draftStore.getResourceDraft(resourceId);
    if (!draft) {
      return false;
    }

    return (
      draft.name.trim() !== resource.name ||
      draft.typeId !== resource.typeId ||
      draft.capacity !== resource.capacity ||
      (draft.mergeGroup ?? null) !== resource.mergeGroup ||
      JSON.stringify(draft.attributeValues) !== JSON.stringify(buildAttributeDraftMap(resource.attributeValues))
    );
  }

  protected typeHue(typeId: string): number {
    let hash = 0;
    for (let i = 0; i < typeId.length; i += 1) {
      hash = (hash << 5) - hash + typeId.charCodeAt(i);
      hash |= 0;
    }

    return Math.abs(hash) % 360;
  }

  protected typeTone(typeId: string, lightness: number): string {
    return `hsl(${this.typeHue(typeId)} 75% ${lightness}%)`;
  }

  protected resourcesForType(typeId: string): number {
    return this.resources().filter((resource) => resource.typeId === typeId).length;
  }

  protected servicesNeedingType(typeId: string): number {
    return this.services().filter((service) =>
      service.requirements.some((requirement) => requirement.resourceTypeId === typeId)
    ).length;
  }

  protected isInlineEditingType(typeId: string): boolean {
    return this.inlineEditingResourceTypeId() === typeId;
  }

  protected startInlineTypeEdit(typeId: string, currentName: string): void {
    this.inlineEditingResourceTypeId.set(typeId);
    this.inlineResourceTypeName.set(currentName);
  }

  protected cancelInlineTypeEdit(): void {
    this.inlineEditingResourceTypeId.set(null);
    this.inlineResourceTypeName.set('');
  }

  protected submitInlineTypeEdit(typeId: string): void {
    const nextName = this.inlineResourceTypeName().trim();
    if (!nextName) {
      return;
    }

    this.updateResourceType.emit({
      resourceTypeId: typeId,
      request: { name: nextName }
    });

    this.inlineEditingResourceTypeId.set(null);
    this.inlineResourceTypeName.set('');
  }

  protected startAttributeDefinitionEdit(attributeDefinitionId: string): void {
    const activeType = this.activeResourceType();
    const definition = activeType?.attributeDefinitions.find((item) => item.id === attributeDefinitionId) ?? null;
    if (!definition) {
      return;
    }

    this.editingAttributeDefinitionId.set(attributeDefinitionId);
    this.attributeDefinitionNameDraft.set(definition.name);
    this.attributeDefinitionTypeDraft.set(definition.type);
    this.attributeDefinitionRequiredDraft.set(definition.required);
    this.attributeDefinitionOptionsDraft.set(definition.options.join(', '));
  }

  protected cancelAttributeDefinitionEdit(): void {
    this.editingAttributeDefinitionId.set(null);
    this.attributeDefinitionNameDraft.set('');
    this.attributeDefinitionTypeDraft.set('TEXT');
    this.attributeDefinitionRequiredDraft.set(false);
    this.attributeDefinitionOptionsDraft.set('');
  }

  protected saveAttributeDefinition(attributeDefinitionId: string): void {
    const activeType = this.activeResourceType();
    if (!activeType) {
      return;
    }

    const name = this.attributeDefinitionNameDraft().trim();
    if (!name) {
      return;
    }

    this.updateResourceAttributeDefinition.emit({
      resourceTypeId: activeType.id,
      attributeDefinitionId,
      request: {
        name,
        type: this.attributeDefinitionTypeDraft(),
        required: this.attributeDefinitionRequiredDraft(),
        options: this.parseAttributeOptions(this.attributeDefinitionOptionsDraft())
      }
    });

    this.cancelAttributeDefinitionEdit();
  }

  protected createAttributeDefinitionForSelectedType(): void {
    const activeType = this.activeResourceType();
    const name = this.newAttributeDefinitionName().trim();
    if (!activeType || !name) {
      return;
    }

    this.createResourceAttributeDefinition.emit({
      resourceTypeId: activeType.id,
      request: {
        name,
        type: this.newAttributeDefinitionType(),
        required: this.newAttributeDefinitionRequired(),
        options: this.parseAttributeOptions(this.newAttributeDefinitionOptions())
      }
    });

    this.newAttributeDefinitionName.set('');
    this.newAttributeDefinitionType.set('TEXT');
    this.newAttributeDefinitionRequired.set(false);
    this.newAttributeDefinitionOptions.set('');
  }

  protected deleteAttributeDefinition(attributeDefinitionId: string): void {
    const activeType = this.activeResourceType();
    if (!activeType) {
      return;
    }

    this.removeResourceAttributeDefinition.emit({
      resourceTypeId: activeType.id,
      attributeDefinitionId
    });

    if (this.editingAttributeDefinitionId() === attributeDefinitionId) {
      this.cancelAttributeDefinitionEdit();
    }
  }

  protected isEditingAttributeDefinition(attributeDefinitionId: string): boolean {
    return this.editingAttributeDefinitionId() === attributeDefinitionId;
  }

  protected isSelectAttributeType(type: DashboardResourceAttributeType): boolean {
    return type === 'SINGLE_SELECT';
  }

  protected parseAttributeOptions(rawOptions: string): string[] {
    return rawOptions
      .split(',')
      .map((option) => option.trim())
      .filter((option) => option.length > 0);
  }

  protected resourceAttributesValid(resourceType: DashboardResourceType | null): boolean {
    if (!resourceType) {
      return false;
    }

    const drafts = this.resourceAttributeDrafts();
    return resourceType.attributeDefinitions.every((definition) => {
      if (!definition.required) {
        return true;
      }

      return (drafts[definition.id] ?? '').trim().length > 0;
    });
  }

  protected hasPreviousTypePage(): boolean {
    return this.resourceTypePageIndex() > 0;
  }

  protected hasNextTypePage(): boolean {
    return this.resourceTypePageIndex() < this.resourceTypePageCount() - 1;
  }

  protected goToPreviousTypePage(): void {
    if (!this.hasPreviousTypePage()) {
      return;
    }

    this.resourceTypePageIndex.update((page) => page - 1);
  }

  protected goToNextTypePage(): void {
    if (!this.hasNextTypePage()) {
      return;
    }

    this.resourceTypePageIndex.update((page) => page + 1);
  }

  protected hasPreviousResourcePage(): boolean {
    return this.resourcePageIndex() > 0;
  }

  protected hasNextResourcePage(): boolean {
    return this.resourcePageIndex() < this.resourcePageCount() - 1;
  }

  protected goToPreviousResourcePage(): void {
    if (!this.hasPreviousResourcePage()) {
      return;
    }

    this.resourcePageIndex.update((page) => page - 1);
  }

  protected goToNextResourcePage(): void {
    if (!this.hasNextResourcePage()) {
      return;
    }

    this.resourcePageIndex.update((page) => page + 1);
  }
}