import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TourPlacement, TourStep } from './dashboard-tour.config';
import { TourService } from '../../data-access/tour.service';

const POPOVER_WIDTH = 320;
const POPOVER_GAP = 14;
const SPOTLIGHT_PADDING = 8;
/** After a route change, wait this long for the new page to render before measuring. */
const NAV_SETTLE_MS = 350;

interface SpotlightStyle {
	top: string;
	left: string;
	width: string;
	height: string;
}

interface PopoverStyle {
	top?: string;
	bottom?: string;
	left?: string;
	right?: string;
	transform?: string;
}

@Component({
	selector: 'app-dashboard-tour',
	imports: [TranslocoPipe],
	templateUrl: './dashboard-tour.html',
	styleUrl: './dashboard-tour.scss',
})
export class DashboardTour implements OnDestroy {
	protected readonly tour = inject(TourService);
	private readonly router = inject(Router);

	private readonly _targetRect = signal<DOMRect | null>(null);

	protected readonly spotlightStyle = computed((): SpotlightStyle | null => {
		const rect = this._targetRect();
		if (!rect) return null;
		const p = SPOTLIGHT_PADDING;
		return {
			top: `${rect.top - p}px`,
			left: `${rect.left - p}px`,
			width: `${rect.width + p * 2}px`,
			height: `${rect.height + p * 2}px`,
		};
	});

	protected readonly popoverStyle = computed((): PopoverStyle => {
		const rect = this._targetRect();
		const step = this.tour.currentStep();
		if (!rect || !step || step.placement === 'center') {
			return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
		}
		return computePopoverPosition(rect, step.placement);
	});

	constructor() {
		effect(() => {
			const step = this.tour.currentStep();
			this._handleStepChange(step);
		});

		window.addEventListener('resize', this.onResize);
		window.addEventListener('scroll', this.onScroll, true);
	}

	ngOnDestroy(): void {
		window.removeEventListener('resize', this.onResize);
		window.removeEventListener('scroll', this.onScroll, true);
	}

	private readonly onResize = (): void => {
		this.refreshRect(this.tour.currentStep());
	};

	private readonly onScroll = (): void => {
		this.refreshRect(this.tour.currentStep());
	};

	private _handleStepChange(step: TourStep | null): void {
		if (!step) {
			this._targetRect.set(null);
			return;
		}

		const needsNav = step.route && !this.router.url.startsWith(step.route);

		if (needsNav) {
			this._targetRect.set(null);
			this.router.navigateByUrl(step.route!).then(() => {
				setTimeout(() => this.refreshRect(step), NAV_SETTLE_MS);
			});
		} else {
			queueMicrotask(() => this.refreshRect(step));
		}
	}

	private refreshRect(step: TourStep | null): void {
		if (!step?.targetSelector) {
			this._targetRect.set(null);
			return;
		}
		const el = document.querySelector(step.targetSelector);
		this._targetRect.set(el ? el.getBoundingClientRect() : null);
	}
}

function computePopoverPosition(rect: DOMRect, placement: TourPlacement): PopoverStyle {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const W = Math.min(POPOVER_WIDTH, vw - 24);
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;

	const clampLeft = (raw: number) => Math.max(12, Math.min(raw, vw - W - 12));

	// Bottom-centered fallback used when preferred placement doesn't fit
	const bottom = (): PopoverStyle => {
		const top = rect.bottom + POPOVER_GAP;
		const left = clampLeft(cx - W / 2);
		// If no room below, flip to above
		if (top + 220 > vh) {
			return { bottom: `${vh - rect.top + POPOVER_GAP}px`, left: `${left}px` };
		}
		return { top: `${top}px`, left: `${left}px` };
	};

	switch (placement) {
		case 'bottom':
		case 'top':
			return bottom();

		case 'right': {
			const left = rect.right + POPOVER_GAP;
			// Fall back to bottom if not enough horizontal room
			if (left + W > vw - 12) return bottom();
			return {
				top: `${Math.max(12, Math.min(cy - 80, vh - 220))}px`,
				left: `${left}px`,
			};
		}

		case 'left': {
			const rightEdge = vw - rect.left + POPOVER_GAP;
			// Fall back to bottom if popover would go off the left edge
			if (vw - rightEdge - W < 12) return bottom();
			return {
				top: `${Math.max(12, Math.min(cy - 80, vh - 220))}px`,
				right: `${rightEdge}px`,
			};
		}

		default:
			return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
	}
}
