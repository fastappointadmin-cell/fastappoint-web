import { Routes } from '@angular/router';
import { authGuard } from './features/auth/auth.guard';
import { resolveTenantSlug } from './core/config/tenant.config';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		// A tenant subdomain (riverside.fastappoint.app) has no path of its own to route on -- the only
		// signal is the hostname itself, so root ('') resolves to a different page per-hostname instead
		// of always being the marketing site.
		loadComponent: () =>
			resolveTenantSlug()
				? import('./features/booking/pages/booking-page/booking-page').then((m) => m.BookingPage)
				: import('./features/marketing/pages/landing-page/landing-page').then((m) => m.LandingPage),
	},
	{
		path: 'login',
		loadComponent: () => import('./features/auth/pages/auth-page/auth-page').then((m) => m.AuthPage),
		data: { mode: 'login' },
	},
	{
		path: 'register',
		loadComponent: () => import('./features/auth/pages/auth-page/auth-page').then((m) => m.AuthPage),
		data: { mode: 'register' },
	},
	{
		path: 'book/:businessId',
		loadComponent: () => import('./features/booking/pages/booking-page/booking-page').then((m) => m.BookingPage),
	},
	{
		path: 'auth/callback',
		loadComponent: () =>
			import('./features/auth/pages/auth-callback-page/auth-callback-page').then((m) => m.AuthCallbackPage),
	},
	{
		path: 'onboarding/create-business',
		loadComponent: () =>
			import('./features/auth/pages/create-business-page/create-business-page').then((m) => m.CreateBusinessPage),
		canActivate: [authGuard],
	},
	{
		path: 'dashboard',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./features/dashboard/pages/dashboard-workspace-page/dashboard-workspace-page').then(
				(m) => m.DashboardWorkspacePage
			),
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'services',
			},
			{
				path: 'services',
				loadComponent: () =>
					import('./features/dashboard/pages/dashboard-services-page/dashboard-services-page').then(
						(m) => m.DashboardServicesPage
					),
			},
			{
				path: 'resources',
				loadComponent: () =>
					import('./features/dashboard/pages/dashboard-resources-page/dashboard-resources-page').then(
						(m) => m.DashboardResourcesPage
					),
			},
			{
				path: 'calendar',
				loadComponent: () =>
					import('./features/dashboard/pages/dashboard-calendar-page/dashboard-calendar-page').then(
						(m) => m.DashboardCalendarPage
					),
			},
			{
				path: 'bookings',
				loadComponent: () =>
					import('./features/dashboard/pages/dashboard-bookings-page/dashboard-bookings-page').then(
						(m) => m.DashboardBookingsPage
					),
			},
			{
				path: 'customers',
				loadComponent: () =>
					import('./features/dashboard/pages/dashboard-customers-page/dashboard-customers-page').then(
						(m) => m.DashboardCustomersPage
					),
			},
			{
				path: 'confirmation-message',
				loadComponent: () =>
					import('./features/dashboard/pages/dashboard-confirmation-message-page/dashboard-confirmation-message-page').then(
						(m) => m.DashboardConfirmationMessagePage
					),
			},
		],
	},
];
