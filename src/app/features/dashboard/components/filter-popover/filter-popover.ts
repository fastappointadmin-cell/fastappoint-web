import { Component, computed, input, signal } from '@angular/core';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  ConnectedPosition,
  OverlayModule
} from '@angular/cdk/overlay';

@Component({
  selector: 'app-filter-popover',
  imports: [OverlayModule, CdkOverlayOrigin, CdkConnectedOverlay],
  templateUrl: './filter-popover.html',
  styleUrl: './filter-popover.scss',
})
export class FilterPopover {
  readonly icon = input('tune');
  readonly ariaLabel = input('Filtre');
  readonly title = input<string | null>(null);
  readonly panelSize = input<'sm' | 'md'>('md');

  protected readonly iconClassByName: Record<string, string> = {
    tune: 'bi-sliders2',
    filter_alt: 'bi-funnel',
    more_vert: 'bi-three-dots-vertical'
  };

  protected readonly isOpen = signal(false);
  protected readonly panelClasses = computed(() => [
    'app-ui-overlay-host',
    this.panelSize() === 'sm' ? 'app-ui-overlay-host--sm' : 'app-ui-overlay-host--md'
  ]);

  protected readonly positions: ConnectedPosition[] = [
    {
      originX: 'end',
      originY: 'center',
      overlayX: 'start',
      overlayY: 'center',
      offsetX: 10
    },
    {
      originX: 'start',
      originY: 'center',
      overlayX: 'end',
      overlayY: 'center',
      offsetX: -10
    },
    {
      originX: 'end',
      originY: 'bottom',
      overlayX: 'end',
      overlayY: 'top',
      offsetY: 8
    },
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'end',
      overlayY: 'bottom',
      offsetY: -8
    }
  ];

  protected toggle(): void {
    this.isOpen.update((open) => !open);
  }

  protected iconClass(): string {
    return this.iconClassByName[this.icon()] ?? 'bi-sliders2';
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
  }
}
