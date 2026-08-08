import { Injectable, signal } from '@angular/core';
import { DashboardUpdateServiceRequirementRequest } from '../models/dashboard-service-requirement.model';

interface ServiceDraft {
  name: string;
  durationSeconds: number;
}

interface ResourceDraft {
  name: string;
  typeId: string;
  capacity: number | null;
  mergeGroup: string | null;
  attributeValues: Record<string, string>;
}

interface PersistedDraftState {
  serviceDrafts: Record<string, ServiceDraft>;
  resourceDrafts: Record<string, ResourceDraft>;
  requirementDrafts: Record<string, Record<string, DashboardUpdateServiceRequirementRequest>>;
  selectedResourceTypeId: string | null;
  selectedResourceId: string | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardEditDraftStore {
  private readonly storageKey = 'fastappoint.dashboard.edit-drafts.v3';
  private readonly legacySessionStorageKey = 'fastappoint.dashboard.edit-drafts';

  private readonly serviceDraftsState = signal<Record<string, ServiceDraft>>({});
  private readonly resourceDraftsState = signal<Record<string, ResourceDraft>>({});
  private readonly requirementDraftsState = signal<Record<string, Record<string, DashboardUpdateServiceRequirementRequest>>>({});
  private readonly selectedResourceTypeIdState = signal<string | null>(null);
  private readonly selectedResourceIdState = signal<string | null>(null);

  constructor() {
    this.hydrateFromStorage();
  }

  hasServiceDraft(serviceId: string): boolean {
    return serviceId in this.serviceDraftsState();
  }

  getServiceDraft(serviceId: string): ServiceDraft | null {
    return this.serviceDraftsState()[serviceId] ?? null;
  }

  setServiceDraft(serviceId: string, draft: ServiceDraft): void {
    this.serviceDraftsState.update((drafts) => ({
      ...drafts,
      [serviceId]: draft
    }));
    this.persistToStorage();
  }

  clearServiceDraft(serviceId: string): void {
    this.serviceDraftsState.update((drafts) => {
      if (!(serviceId in drafts)) {
        return drafts;
      }

      const nextDrafts = { ...drafts };
      delete nextDrafts[serviceId];
      return nextDrafts;
    });
    this.persistToStorage();
  }

  hasResourceDraft(resourceId: string): boolean {
    return resourceId in this.resourceDraftsState();
  }

  getResourceDraft(resourceId: string): ResourceDraft | null {
    return this.resourceDraftsState()[resourceId] ?? null;
  }

  setResourceDraft(resourceId: string, draft: ResourceDraft): void {
    this.resourceDraftsState.update((drafts) => ({
      ...drafts,
      [resourceId]: draft
    }));
    this.persistToStorage();
  }

  clearResourceDraft(resourceId: string): void {
    this.resourceDraftsState.update((drafts) => {
      if (!(resourceId in drafts)) {
        return drafts;
      }

      const nextDrafts = { ...drafts };
      delete nextDrafts[resourceId];
      return nextDrafts;
    });
    this.persistToStorage();
  }

  hasRequirementDrafts(serviceId: string): boolean {
    return Object.keys(this.requirementDraftsState()[serviceId] ?? {}).length > 0;
  }

  getSelectedResourceTypeId(): string | null {
    return this.selectedResourceTypeIdState();
  }

  setSelectedResourceTypeId(resourceTypeId: string | null): void {
    this.selectedResourceTypeIdState.set(resourceTypeId);
    this.persistToStorage();
  }

  getSelectedResourceId(): string | null {
    return this.selectedResourceIdState();
  }

  setSelectedResourceId(resourceId: string | null): void {
    this.selectedResourceIdState.set(resourceId);
    this.persistToStorage();
  }

  getRequirementDrafts(serviceId: string): Record<string, DashboardUpdateServiceRequirementRequest> {
    return this.requirementDraftsState()[serviceId] ?? {};
  }

  setRequirementDraft(
    serviceId: string,
    requirementId: string,
    draft: DashboardUpdateServiceRequirementRequest
  ): void {
    this.requirementDraftsState.update((draftsByService) => ({
      ...draftsByService,
      [serviceId]: {
        ...(draftsByService[serviceId] ?? {}),
        [requirementId]: draft
      }
    }));
    this.persistToStorage();
  }

  clearRequirementDraft(serviceId: string, requirementId: string): void {
    this.requirementDraftsState.update((draftsByService) => {
      const serviceDrafts = draftsByService[serviceId];
      if (!serviceDrafts || !(requirementId in serviceDrafts)) {
        return draftsByService;
      }

      const nextServiceDrafts = { ...serviceDrafts };
      delete nextServiceDrafts[requirementId];

      if (Object.keys(nextServiceDrafts).length === 0) {
        const nextDraftsByService = { ...draftsByService };
        delete nextDraftsByService[serviceId];
        return nextDraftsByService;
      }

      return {
        ...draftsByService,
        [serviceId]: nextServiceDrafts
      };
    });
    this.persistToStorage();
  }

  clearAll(): void {
    this.serviceDraftsState.set({});
    this.resourceDraftsState.set({});
    this.requirementDraftsState.set({});
    this.selectedResourceTypeIdState.set(null);
    this.selectedResourceIdState.set(null);

    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(this.storageKey);
    window.sessionStorage.removeItem(this.legacySessionStorageKey);
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const rawState = window.localStorage.getItem(this.storageKey)
      ?? window.sessionStorage.getItem(this.legacySessionStorageKey);
    if (!rawState) {
      return;
    }

    try {
      const parsed = JSON.parse(rawState) as Partial<PersistedDraftState>;
      this.serviceDraftsState.set(parsed.serviceDrafts ?? {});
      this.resourceDraftsState.set(parsed.resourceDrafts ?? {});
      this.requirementDraftsState.set(parsed.requirementDrafts ?? {});
      this.selectedResourceTypeIdState.set(parsed.selectedResourceTypeId ?? null);
      this.selectedResourceIdState.set(parsed.selectedResourceId ?? null);
      window.localStorage.setItem(this.storageKey, rawState);
      window.sessionStorage.removeItem(this.legacySessionStorageKey);
    } catch {
      this.serviceDraftsState.set({});
      this.resourceDraftsState.set({});
      this.requirementDraftsState.set({});
      this.selectedResourceTypeIdState.set(null);
      this.selectedResourceIdState.set(null);
      window.localStorage.removeItem(this.storageKey);
      window.sessionStorage.removeItem(this.legacySessionStorageKey);
    }
  }

  private persistToStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const state: PersistedDraftState = {
      serviceDrafts: this.serviceDraftsState(),
      resourceDrafts: this.resourceDraftsState(),
      requirementDrafts: this.requirementDraftsState(),
      selectedResourceTypeId: this.selectedResourceTypeIdState(),
      selectedResourceId: this.selectedResourceIdState()
    };

    window.localStorage.setItem(this.storageKey, JSON.stringify(state));
    window.sessionStorage.removeItem(this.legacySessionStorageKey);
  }
}
