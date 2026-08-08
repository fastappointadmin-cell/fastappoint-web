import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  DashboardService,
  DashboardUpdateServiceRequest
} from '../../models/dashboard-service.model';
import { DashboardAddServiceRequirementRequest } from '../../models/dashboard-service-requirement.model';
import { DashboardUpdateServiceRequirementRequest } from '../../models/dashboard-service-requirement.model';
import { DashboardResourceType } from '../../models/dashboard-resource.model';
import { ServiceRequirementsEditor } from '../service-requirements-editor/service-requirements-editor';
import { Dialog } from '@angular/cdk/dialog';
import { ServiceRequirementCreateDialog } from '../service-requirement-create-dialog/service-requirement-create-dialog.entry';
import { EditPanelComponent } from '../edit-panel/edit-panel';
import { DashboardEditDraftStore } from '../../data-access/dashboard-edit-draft-store';

@Component({
  selector: 'app-service-form',
  imports: [
    FormsModule,
    ServiceRequirementsEditor,
    EditPanelComponent,
    TranslocoPipe
  ],
  templateUrl: './service-form.html',
  styleUrl: './service-form.scss',
})
export class ServiceForm {
  private readonly dialog = inject(Dialog);
  private readonly draftStore = inject(DashboardEditDraftStore);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly service = input.required<DashboardService>();
  readonly resourceTypes = input.required<DashboardResourceType[]>();

  /** Pre-resolved (not translation keys) since they interpolate live data -- edit-panel just displays
   * whatever string it's handed, so the interpolation has to happen here. Depending on activeLang()
   * keeps them re-computing on a language switch even though the underlying service data hasn't changed. */
  protected readonly panelTitle = computed(() => {
    this.activeLang();
    return this.transloco.translate('dashboard.services.form.editingTitle', { name: this.service().name });
  });
  protected readonly panelSubtitle = computed(() => {
    this.activeLang();
    return this.transloco.translate('dashboard.services.form.currentDurationSubtitle', { minutes: Math.round(this.service().durationSeconds / 60) });
  });

  readonly updateService = output<{ serviceId: string; request: DashboardUpdateServiceRequest }>();
  readonly addRequirement = output<{ serviceId: string; request: DashboardAddServiceRequirementRequest }>();
  readonly updateRequirement = output<{ serviceId: string; requirementId: string; request: DashboardUpdateServiceRequirementRequest }>();
  readonly removeRequirement = output<{ serviceId: string; requirementId: string }>();

  protected readonly name = signal('');
  protected readonly durationSeconds = signal<number>(0);
  protected readonly durationMinutes = computed(() => Math.round(this.durationSeconds() / 60));
  protected readonly hydratedServiceId = signal<string | null>(null);

  protected readonly hasServiceChanges = computed(() => {
    const service = this.service();
    const draftName = this.name().trim();
    const draftDuration = this.durationSeconds();

    const hasNameChange = draftName.length > 0 && draftName !== service.name;
    const hasDurationChange = draftDuration !== service.durationSeconds;

    return hasNameChange || hasDurationChange;
  });

  protected readonly canSaveServiceChanges = computed(() => {
    if (!this.hasServiceChanges()) {
      return false;
    }

    const service = this.service();
    const draftName = this.name().trim();
    const draftDuration = this.durationSeconds();

    return draftName.length > 0 && draftDuration >= 60;
  });

  constructor() {
    effect(() => {
      const service = this.service();
      const hydratedServiceId = this.hydratedServiceId();

      if (hydratedServiceId === service.id) {
        if (!this.draftStore.getServiceDraft(service.id)) {
          this.name.set(service.name);
          this.durationSeconds.set(service.durationSeconds);
        }
        return;
      }

      const persistedDraft = this.draftStore.getServiceDraft(service.id);
      this.name.set(persistedDraft?.name ?? service.name);
      this.durationSeconds.set(persistedDraft?.durationSeconds ?? service.durationSeconds);
      this.hydratedServiceId.set(service.id);
    });

    effect(() => {
      const service = this.service();
      if (this.hydratedServiceId() !== service.id) {
        return;
      }

      const draftName = this.name().trim();
      const draftDuration = this.durationSeconds();

      const isDirty = draftName !== service.name || draftDuration !== service.durationSeconds;
      if (!isDirty) {
        this.draftStore.clearServiceDraft(service.id);
        return;
      }

      this.draftStore.setServiceDraft(service.id, {
        name: this.name(),
        durationSeconds: draftDuration
      });
    });
  }

  protected openCreateRequirementDialog(): void {
    const dialogRef = this.dialog.open(ServiceRequirementCreateDialog, {
      width: '460px',
      maxWidth: '92vw',
      panelClass: 'app-ui-dialog-panel',
      backdropClass: 'app-ui-dialog-backdrop',
      data: {
        resourceTypes: this.resourceTypes()
      }
    });

    dialogRef.closed.subscribe((result) => {
      const request = result as DashboardAddServiceRequirementRequest | null | undefined;
      if (request) {
        this.addRequirement.emit({ serviceId: this.service().id, request });
      }
    });
  }

  protected setDurationMinutes(minutes: number | string): void {
    this.durationSeconds.set((+minutes || 0) * 60);
  }

  protected submitUpdate(): void {
    if (!this.canSaveServiceChanges()) {
      return;
    }

    const service = this.service();
    const trimmedName = this.name().trim() || service.name;
    const submittedDuration = this.durationSeconds();

    this.updateService.emit({
      serviceId: service.id,
      request: {
        name: trimmedName,
        durationSeconds: submittedDuration
      }
    });

    this.draftStore.clearServiceDraft(service.id);
    this.name.set(trimmedName);
    this.durationSeconds.set(submittedDuration);
  }

  protected discardServiceEdits(): void {
    const service = this.service();
    this.name.set(service.name);
    this.durationSeconds.set(service.durationSeconds);
    this.draftStore.clearServiceDraft(service.id);
  }
  
  protected onUpdateRequirement(event: { requirementId: string; request: DashboardUpdateServiceRequirementRequest }): void {
    this.updateRequirement.emit({
      serviceId: this.service().id,
      requirementId: event.requirementId,
      request: event.request
    });
  }
  
  protected onRemoveRequirement(requirementId: string): void {
    this.removeRequirement.emit({ serviceId: this.service().id, requirementId });
  }
}
