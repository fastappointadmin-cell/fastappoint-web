import { Injectable, computed, signal } from '@angular/core';
import { DASHBOARD_TOUR_STEPS, TourStep } from '../components/dashboard-tour/dashboard-tour.config';

const TOUR_SEEN_KEY = 'fastappoint_dashboard_tour_seen';

@Injectable({ providedIn: 'root' })
export class TourService {
	private readonly _isActive = signal(false);
	private readonly _currentIndex = signal(0);

	readonly isActive = this._isActive.asReadonly();
	readonly currentIndex = this._currentIndex.asReadonly();
	readonly totalSteps = DASHBOARD_TOUR_STEPS.length;

	readonly currentStep = computed((): TourStep | null =>
		this._isActive() ? (DASHBOARD_TOUR_STEPS[this._currentIndex()] ?? null) : null
	);
	readonly isLastStep = computed(() => this._currentIndex() === DASHBOARD_TOUR_STEPS.length - 1);
	readonly isFirstStep = computed(() => this._currentIndex() === 0);

	get hasSeen(): boolean {
		try {
			return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
		} catch {
			return false;
		}
	}

	start(fromIndex = 0): void {
		this._currentIndex.set(fromIndex);
		this._isActive.set(true);
	}

	next(): void {
		if (this.isLastStep()) {
			this.finish();
		} else {
			this._currentIndex.update((i) => i + 1);
		}
	}

	prev(): void {
		if (!this.isFirstStep()) {
			this._currentIndex.update((i) => i - 1);
		}
	}

	finish(): void {
		this._isActive.set(false);
		try {
			localStorage.setItem(TOUR_SEEN_KEY, 'true');
		} catch {
			// ignore storage errors
		}
	}

	skip(): void {
		this.finish();
	}
}
