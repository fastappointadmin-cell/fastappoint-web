import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

/** Every text input here is a pre-resolved display string, not a translation key -- the caller (which
 * knows whether it needs plain translated text or an interpolated one, e.g. "Editing service: X")
 * resolves it via TranslocoService first. The one exception is `pendingLabel`'s default, which is
 * identical everywhere this component is used, so it's resolved here instead of duplicating it at
 * every call site. */
@Component({
  selector: 'app-edit-panel',
  templateUrl: './edit-panel.html',
  styleUrl: './edit-panel.scss',
})
export class EditPanelComponent {
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly badge = input<string | null>(null);
  readonly iconClass = input('bi-pencil-square');
  readonly pendingChanges = input(false);
  readonly pendingLabel = input<string | null>(null);
  protected readonly resolvedPendingLabel = computed(() => {
    this.activeLang();
    return this.pendingLabel() ?? this.transloco.translate('dashboard.common.unsaved');
  });

  readonly canSave = input(false);
  readonly canUndo = input(false);
  readonly saveAriaLabel = input<string | null>(null);
  readonly undoAriaLabel = input<string | null>(null);
  protected readonly resolvedSaveAriaLabel = computed(() => {
    this.activeLang();
    return this.saveAriaLabel() ?? this.transloco.translate('dashboard.common.save');
  });
  protected readonly resolvedUndoAriaLabel = computed(() => {
    this.activeLang();
    return this.undoAriaLabel() ?? this.transloco.translate('dashboard.common.undo');
  });

  readonly saveClicked = output<void>();
  readonly undoClicked = output<void>();

  protected onSave(): void {
    if (!this.canSave()) {
      return;
    }

    this.saveClicked.emit();
  }

  protected onUndo(): void {
    if (!this.canUndo()) {
      return;
    }

    this.undoClicked.emit();
  }
}