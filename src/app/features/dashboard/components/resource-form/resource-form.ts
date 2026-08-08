import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  DashboardCreateResourceRequest,
  DashboardResourceType
} from '../../models/dashboard-resource.model';

@Component({
  selector: 'app-resource-form',
  imports: [FormsModule, TranslocoPipe],
  templateUrl: './resource-form.html',
  styleUrl: './resource-form.scss',
})
export class ResourceForm {
  readonly resourceTypes = input.required<DashboardResourceType[]>();
  readonly createResource = output<DashboardCreateResourceRequest>();

  protected readonly name = signal('');
  protected readonly typeId = signal('');
  protected readonly capacity = signal<number | null>(null);

  protected submit(): void {
    const trimmedName = this.name().trim();
    const selectedTypeId = this.typeId();
    if (!trimmedName || !selectedTypeId) {
      return;
    }

    this.createResource.emit({
      name: trimmedName,
      typeId: selectedTypeId,
      capacity: this.capacity(),
      mergeGroup: null,
      attributeValues: []
    });

    this.name.set('');
    this.capacity.set(null);
  }
}
