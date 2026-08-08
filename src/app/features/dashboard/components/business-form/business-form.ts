import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardCreateBusinessRequest } from '../../models/dashboard-business.model';

@Component({
  selector: 'app-business-form',
  imports: [FormsModule, TranslocoPipe],
  templateUrl: './business-form.html',
  styleUrl: './business-form.scss',
})
export class BusinessForm {
  protected readonly businessName = signal('');
  readonly initialName = input<string | null>(null);
  /** A translation KEY, not literal text -- rendered through the transloco pipe in the template. */
  readonly submitLabel = input('dashboard.businessForm.createSubmit');
  readonly saveBusiness = output<DashboardCreateBusinessRequest>();

  constructor() {
    effect(() => {
      const initialName = this.initialName();
      if (initialName !== null) {
        this.businessName.set(initialName);
      }
    });
  }

  protected submit(): void {
    const trimmedName = this.businessName().trim();
    if (!trimmedName) {
      return;
    }

    this.saveBusiness.emit({ name: trimmedName });
    this.businessName.set(trimmedName);
  }
}
