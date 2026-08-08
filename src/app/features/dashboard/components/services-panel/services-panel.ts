import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  DashboardCreateServiceRequest,
  DashboardService,
  DashboardUpdateServiceRequest
} from '../../models/dashboard-service.model';
import {
  DashboardAddServiceRequirementRequest,
  DashboardUpdateServiceRequirementRequest
} from '../../models/dashboard-service-requirement.model';
import { DashboardResourceType } from '../../models/dashboard-resource.model';
import { FixedSlotsListComponent } from '../fixed-slots-list/fixed-slots-list';
import { FilterPopover } from '../filter-popover/filter-popover';
import { ServiceForm } from '../service-form/service-form.entry';
import { ServiceCreateDialog } from '../service-create-dialog/service-create-dialog.entry';
import { DashboardEditDraftStore } from '../../data-access/dashboard-edit-draft-store';

@Component({
  selector: 'app-services-panel',
  imports: [
    FormsModule,
    ServiceForm,
    FilterPopover,
    FixedSlotsListComponent,
    TranslocoPipe
  ],
  templateUrl: './services-panel.html',
  styleUrl: './services-panel.scss',
  host: {
    '(window:resize)': 'onViewportResize()'
  }
})
export class ServicesPanel {
  private readonly dialog = inject(Dialog);
  private readonly draftStore = inject(DashboardEditDraftStore);
  /** 1, nu 2: pe ecrane foarte mici, capacitatea reală măsurată poate fi doar 1 rând -- forțarea unui minim de
   * 2 ar însemna să arătăm mai multe rânduri decât încap cu adevărat, exact bug-ul pe care capacitatea
   * măsurată din DOM trebuia să-l elimine. */
  private readonly minPageSize = 1;
  private readonly maxPageSize = 20;
  private readonly compactPlaceholderViewportWidth = 768;

  readonly services = input.required<DashboardService[]>();
  readonly resourceTypes = input.required<DashboardResourceType[]>();

  readonly createService = output<DashboardCreateServiceRequest>();
  readonly updateService = output<{ serviceId: string; request: DashboardUpdateServiceRequest }>();
  readonly addRequirement = output<{ serviceId: string; request: DashboardAddServiceRequirementRequest }>();
  readonly updateRequirement = output<{ serviceId: string; requirementId: string; request: DashboardUpdateServiceRequirementRequest }>();
  readonly removeRequirement = output<{ serviceId: string; requirementId: string }>();

  protected readonly selectedServiceId = signal<string | null>(null);
  protected readonly serviceSearchQuery = signal('');
  protected readonly durationOperator = signal<'any' | 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between'>('any');
  protected readonly durationValue = signal<string>('');
  protected readonly durationValueMax = signal<string>('');
  protected readonly requirementCountOperator = signal<'any' | 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between'>('any');
  protected readonly requirementCountValue = signal<string>('');
  protected readonly requirementCountValueMax = signal<string>('');
  protected readonly servicePageIndex = signal(0);
  protected readonly viewportWidth = signal(0);
  /** Câte rânduri încap efectiv, măsurat direct din DOM de `app-fixed-slots-list` (vezi capacityChange). */
  protected readonly currentPageSize = signal(this.minPageSize);

  protected readonly filteredServices = computed(() => {
    const query = this.serviceSearchQuery().trim().toLowerCase();
    const durationOperator = this.durationOperator();
    const durationValue = this.parseFilterNumber(this.durationValue());
    const durationValueMax = this.parseFilterNumber(this.durationValueMax());
    const requirementCountOperator = this.requirementCountOperator();
    const requirementCountValue = this.parseFilterNumber(this.requirementCountValue());
    const requirementCountValueMax = this.parseFilterNumber(this.requirementCountValueMax());

    return this.services().filter((service) => {
      const durationLabel = String(service.durationSeconds);
      const matchesSearch =
        !query ||
        service.name.toLowerCase().includes(query) ||
        durationLabel.includes(query);

      const matchesDuration = this.matchesNumberFilter(
        service.durationSeconds,
        durationOperator,
        durationValue,
        durationValueMax
      );

      const matchesRequirementCount = this.matchesNumberFilter(
        service.requirements.length,
        requirementCountOperator,
        requirementCountValue,
        requirementCountValueMax
      );

      return matchesSearch && matchesDuration && matchesRequirementCount;
    });
  });

  protected readonly servicePageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredServices().length / this.currentPageSize()))
  );

  protected readonly pagedServices = computed(() => {
    const pageSize = this.currentPageSize();
    const start = this.servicePageIndex() * pageSize;
    return this.filteredServices().slice(start, start + pageSize);
  });

  protected readonly servicePlaceholderTargetSlots = computed(() => {
    const pageSize = this.currentPageSize();
    const currentCount = this.pagedServices().length;

    // On mobile, keep only one spare visual slot to avoid large empty gaps.
    if (this.viewportWidth() < this.compactPlaceholderViewportWidth) {
      return Math.min(pageSize, currentCount + 1);
    }

    return pageSize;
  });

  protected readonly servicePlaceholderSlots = computed(() => {
    const missingSlots = this.servicePlaceholderTargetSlots() - this.pagedServices().length;
    return Array.from({ length: Math.max(0, missingSlots) }, (_, index) => index);
  });

  constructor() {
    this.syncViewportSize();

    effect(() => {
      const allServices = this.services();
      const selectedId = this.selectedServiceId();

      if (!allServices.length) {
        // Keep the current selection during transient reload gaps.
        return;
      }

      if (!selectedId || !allServices.some((service) => service.id === selectedId)) {
        this.selectedServiceId.set(allServices[0].id);
      }

      const maxPage = Math.max(0, this.servicePageCount() - 1);
      if (this.servicePageIndex() > maxPage) {
        this.servicePageIndex.set(maxPage);
      }
    });

    effect(() => {
      const selectedId = this.selectedServiceId();
      if (!selectedId) {
        return;
      }

      const selectedIndex = this.filteredServices().findIndex((service) => service.id === selectedId);
      if (selectedIndex < 0) {
        return;
      }

      this.servicePageIndex.set(Math.floor(selectedIndex / this.currentPageSize()));
    });
  }

  protected setServiceSearchQuery(value: string): void {
    this.serviceSearchQuery.set(value);
    this.servicePageIndex.set(0);
  }

  protected setDurationOperator(value: 'any' | 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between'): void {
    this.durationOperator.set(value);
    this.servicePageIndex.set(0);
  }

  protected setDurationValue(value: string): void {
    this.durationValue.set(value);
    this.servicePageIndex.set(0);
  }

  protected setDurationValueMax(value: string): void {
    this.durationValueMax.set(value);
    this.servicePageIndex.set(0);
  }

  protected setRequirementCountOperator(value: 'any' | 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between'): void {
    this.requirementCountOperator.set(value);
    this.servicePageIndex.set(0);
  }

  protected setRequirementCountValue(value: string): void {
    this.requirementCountValue.set(value);
    this.servicePageIndex.set(0);
  }

  protected setRequirementCountValueMax(value: string): void {
    this.requirementCountValueMax.set(value);
    this.servicePageIndex.set(0);
  }

  protected clearServiceFilters(): void {
    this.setDurationOperator('any');
    this.setDurationValue('');
    this.setDurationValueMax('');
    this.setRequirementCountOperator('any');
    this.setRequirementCountValue('');
    this.setRequirementCountValueMax('');
  }

  protected onViewportResize(): void {
    this.syncViewportSize();
  }

  private syncViewportSize(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.viewportWidth.set(window.innerWidth);
  }

  /** Capacitatea reală (câte rânduri încap), raportată de `app-fixed-slots-list` via ResizeObserver. */
  protected onServicesCapacity(capacity: number): void {
    this.currentPageSize.set(Math.max(this.minPageSize, Math.min(this.maxPageSize, capacity)));
  }

  protected openCreateServiceDialog(): void {
    const dialogRef = this.dialog.open(ServiceCreateDialog, {
      width: '520px',
      maxWidth: '92vw',
      panelClass: 'app-ui-dialog-panel',
      backdropClass: 'app-ui-dialog-backdrop'
    });

    dialogRef.closed.subscribe((result) => {
      const request = result as DashboardCreateServiceRequest | null | undefined;
      if (request) {
        this.createService.emit(request);
      }
    });
  }

  protected selectService(serviceId: string): void {
    this.selectedServiceId.set(serviceId);
  }

  protected restoreSelectedService(serviceId: string | null): void {
    if (!serviceId) {
      return;
    }

    this.selectedServiceId.set(serviceId);
  }

  protected goToPreviousServicePage(): void {
    this.servicePageIndex.update((currentPage) => Math.max(0, currentPage - 1));
  }

  protected goToNextServicePage(): void {
    this.servicePageIndex.update((currentPage) =>
      Math.min(this.servicePageCount() - 1, currentPage + 1)
    );
  }

  protected hasPreviousServicePage(): boolean {
    return this.servicePageIndex() > 0;
  }

  protected hasNextServicePage(): boolean {
    return this.servicePageIndex() < this.servicePageCount() - 1;
  }

  protected activeService(): DashboardService | null {
    const selectedId = this.selectedServiceId();
    if (!selectedId) {
      return null;
    }

    return this.services().find((service) => service.id === selectedId) ?? null;
  }

  protected onUpdateService(event: { serviceId: string; request: DashboardUpdateServiceRequest }): void {
    this.updateService.emit(event);
  }

  protected onAddRequirement(event: { serviceId: string; request: DashboardAddServiceRequirementRequest }): void {
    this.addRequirement.emit(event);
  }

  protected onUpdateRequirement(event: {
    serviceId: string;
    requirementId: string;
    request: DashboardUpdateServiceRequirementRequest;
  }): void {
    this.updateRequirement.emit(event);
  }

  protected onRemoveRequirement(event: { serviceId: string; requirementId: string }): void {
    this.removeRequirement.emit(event);
  }

  protected serviceHasPendingEdits(serviceId: string): boolean {
    const service = this.services().find((item) => item.id === serviceId);
    if (!service) {
      return false;
    }

    const serviceDraft = this.draftStore.getServiceDraft(serviceId);
    const hasServiceChanges =
      !!serviceDraft && (
        serviceDraft.name.trim() !== service.name ||
        serviceDraft.durationSeconds !== service.durationSeconds
      );

    if (hasServiceChanges) {
      return true;
    }

    const requirementDrafts = this.draftStore.getRequirementDrafts(serviceId);
    return Object.entries(requirementDrafts).some(([requirementId, draft]) => {
      const requirement = service.requirements.find((item) => item.id === requirementId);
      if (!requirement) {
        return false;
      }

      return (
        draft.resourceTypeId !== requirement.resourceTypeId ||
        draft.quantity !== requirement.quantity
      );
    });
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
    value: number,
    operator: 'any' | 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between',
    primary: number | null,
    secondary: number | null
  ): boolean {
    if (operator === 'any') {
      return true;
    }

    if (primary === null) {
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
}
