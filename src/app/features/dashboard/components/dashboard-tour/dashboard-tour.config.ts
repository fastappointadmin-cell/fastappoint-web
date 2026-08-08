export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface TourStep {
	id: string;
	titleKey: string;
	descriptionKey: string;
	/** CSS selector for the element to highlight. Null = centred modal (no spotlight). */
	targetSelector: string | null;
	placement: TourPlacement;
	/** Navigate to this route before showing the step. */
	route?: string;
}

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
	{
		id: 'welcome',
		titleKey: 'dashboard.tour.steps.welcome.title',
		descriptionKey: 'dashboard.tour.steps.welcome.description',
		targetSelector: null,
		placement: 'center',
	},
	{
		id: 'header',
		titleKey: 'dashboard.tour.steps.header.title',
		descriptionKey: 'dashboard.tour.steps.header.description',
		targetSelector: '[data-tour="header"]',
		placement: 'bottom',
	},
	{
		id: 'business',
		titleKey: 'dashboard.tour.steps.business.title',
		descriptionKey: 'dashboard.tour.steps.business.description',
		targetSelector: '[data-tour="business"]',
		placement: 'bottom',
	},
	{
		id: 'nav',
		titleKey: 'dashboard.tour.steps.nav.title',
		descriptionKey: 'dashboard.tour.steps.nav.description',
		targetSelector: '[data-tour="nav"]',
		placement: 'right',
	},
	// ── Services ────────────────────────────────────────────────────────────
	{
		id: 'services-intro',
		titleKey: 'dashboard.tour.steps.servicesIntro.title',
		descriptionKey: 'dashboard.tour.steps.servicesIntro.description',
		targetSelector: '[data-tour="services-header"]',
		placement: 'bottom',
		route: '/dashboard/services',
	},
	{
		id: 'services-list',
		titleKey: 'dashboard.tour.steps.servicesList.title',
		descriptionKey: 'dashboard.tour.steps.servicesList.description',
		targetSelector: '[data-tour="services-section"]',
		placement: 'bottom',
		route: '/dashboard/services',
	},
	{
		id: 'service-requirements',
		titleKey: 'dashboard.tour.steps.serviceRequirements.title',
		descriptionKey: 'dashboard.tour.steps.serviceRequirements.description',
		targetSelector: '[data-tour="service-requirements"]',
		placement: 'top',
		route: '/dashboard/services',
	},
	// ── Resources ───────────────────────────────────────────────────────────
	{
		id: 'resources-intro',
		titleKey: 'dashboard.tour.steps.resourcesIntro.title',
		descriptionKey: 'dashboard.tour.steps.resourcesIntro.description',
		targetSelector: '[data-tour="resources-header"]',
		placement: 'bottom',
		route: '/dashboard/resources',
	},
	{
		id: 'resource-types',
		titleKey: 'dashboard.tour.steps.resourceTypes.title',
		descriptionKey: 'dashboard.tour.steps.resourceTypes.description',
		targetSelector: '[data-tour="resource-types"]',
		placement: 'bottom',
		route: '/dashboard/resources',
	},
	{
		id: 'resource-attributes',
		titleKey: 'dashboard.tour.steps.resourceAttributes.title',
		descriptionKey: 'dashboard.tour.steps.resourceAttributes.description',
		targetSelector: '[data-tour="resource-attributes"]',
		placement: 'bottom',
		route: '/dashboard/resources',
	},
	{
		id: 'resource-combining',
		titleKey: 'dashboard.tour.steps.resourceCombining.title',
		descriptionKey: 'dashboard.tour.steps.resourceCombining.description',
		targetSelector: '[data-tour="resource-combining"]',
		placement: 'bottom',
		route: '/dashboard/resources',
	},
	// ── Calendar ────────────────────────────────────────────────────────────
	{
		id: 'calendar-intro',
		titleKey: 'dashboard.tour.steps.calendarIntro.title',
		descriptionKey: 'dashboard.tour.steps.calendarIntro.description',
		targetSelector: '[data-tour="calendar-topbar"]',
		placement: 'bottom',
		route: '/dashboard/calendar',
	},
	{
		id: 'calendar-sidebar',
		titleKey: 'dashboard.tour.steps.calendarSidebar.title',
		descriptionKey: 'dashboard.tour.steps.calendarSidebar.description',
		targetSelector: '[data-tour="calendar-sidebar"]',
		placement: 'right',
		route: '/dashboard/calendar',
	},
	{
		id: 'calendar-grid',
		titleKey: 'dashboard.tour.steps.calendarGrid.title',
		descriptionKey: 'dashboard.tour.steps.calendarGrid.description',
		targetSelector: '[data-tour="calendar-main"]',
		placement: 'bottom',
		route: '/dashboard/calendar',
	},
];
