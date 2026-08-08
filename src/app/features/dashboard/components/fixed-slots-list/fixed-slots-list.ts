import { Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-fixed-slots-list, pp-fixed-slots-list',
  imports: [TranslocoPipe],
  templateUrl: './fixed-slots-list.html',
  styleUrl: './fixed-slots-list.scss'
})
export class FixedSlotsListComponent {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly listItemsEl = viewChild<ElementRef<HTMLElement>>('listItemsEl');
  private readonly hasHydratedSelection = signal(false);
  private lastReportedCapacity = -1;

  readonly hasItems = input.required<boolean>();
  /** Translation key, not literal text -- rendered through the transloco pipe below. */
  readonly emptyText = input.required<string>();
  readonly placeholderSlots = input.required<number[]>();
  readonly rightPadding = input(false);

  readonly selectedItemId = input<string | null>(null);
  readonly persistSelectionKey = input<string | null>(null);

  /** Translation keys, not literal text -- rendered through the transloco pipe below. */
  readonly addButtonLabel = input<string | null>(null);
  readonly addButtonDisabled = input(false);
  readonly searchPlaceholder = input<string | null>(null);
  readonly searchValue = input('');

  readonly showPagination = input(false);
  readonly pageIndex = input(0);
  readonly pageCount = input(1);
  readonly canGoPrevious = input(false);
  readonly canGoNext = input(false);

  readonly addClicked = output<void>();
  readonly searchValueChange = output<string>();
  readonly previousPageClicked = output<void>();
  readonly nextPageClicked = output<void>();
  readonly restoredSelectedItemId = output<string | null>();
  /** Câte rânduri încap efectiv în zona vizibilă -- măsurat direct din DOM, nu estimat din dimensiunile ferestrei. */
  readonly capacityChange = output<number>();

  constructor() {
    effect((onCleanup) => {
      const container = this.listItemsEl()?.nativeElement;
      if (!container || typeof ResizeObserver === 'undefined') {
        return;
      }

      const reportCapacity = () => {
        const rowHeightPx = this.readRowHeightPx();
        if (!rowHeightPx) {
          return;
        }
        const capacity = Math.max(1, Math.floor(container.clientHeight / rowHeightPx));
        if (capacity !== this.lastReportedCapacity) {
          this.lastReportedCapacity = capacity;
          this.capacityChange.emit(capacity);
        }
      };

      const observer = new ResizeObserver(reportCapacity);
      observer.observe(container);
      reportCapacity();
      onCleanup(() => observer.disconnect());
    });

    effect(() => {
      const storageKey = this.persistSelectionKey();
      if (!storageKey || this.hasHydratedSelection()) {
        return;
      }

      if (typeof window === 'undefined') {
        this.hasHydratedSelection.set(true);
        return;
      }

      const storedValue = window.localStorage.getItem(`fastappoint.fixed-slots.selection.${storageKey}`);
      this.restoredSelectedItemId.emit(storedValue);
      this.hasHydratedSelection.set(true);
    });

    effect(() => {
      const storageKey = this.persistSelectionKey();
      if (!storageKey || !this.hasHydratedSelection()) {
        return;
      }

      if (typeof window === 'undefined') {
        return;
      }

      const selectedItemId = this.selectedItemId();
      const finalStorageKey = `fastappoint.fixed-slots.selection.${storageKey}`;

      if (!selectedItemId) {
        window.localStorage.removeItem(finalStorageKey);
        return;
      }

      window.localStorage.setItem(finalStorageKey, selectedItemId);
    });
  }

  /**
   * Citește `--fixed-slot-row-min-height` din stilurile calculate ale host-ului (setată de consumator, ex.
   * `resources-panel`/`services-panel`, și ajustată pe breakpoint-uri) -- așa rămâne sincronizată cu înălțimea
   * REALĂ a unui rând, indiferent de breakpoint sau de zoom-ul paginii.
   */
  private readRowHeightPx(): number {
    const raw = getComputedStyle(this.hostRef.nativeElement).getPropertyValue('--fixed-slot-row-min-height').trim();
    if (!raw) {
      return 0;
    }
    if (raw.endsWith('px')) {
      return parseFloat(raw) || 0;
    }
    if (raw.endsWith('rem')) {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return (parseFloat(raw) || 0) * rootFontSize;
    }
    return parseFloat(raw) || 0;
  }

  protected onSearchInput(value: string): void {
    this.searchValueChange.emit(value);
  }

  protected onAddClick(): void {
    this.addClicked.emit();
  }

  protected onPreviousPageClick(): void {
    this.previousPageClicked.emit();
  }

  protected onNextPageClick(): void {
    this.nextPageClicked.emit();
  }
}
