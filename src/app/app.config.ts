import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';

import { routes } from './app.routes';
import { authInterceptor } from './features/auth/auth.interceptor';
import { AVAILABLE_LOCALES, resolveInitialLocale } from './core/i18n/locale';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideTransloco({
      config: {
        availableLangs: AVAILABLE_LOCALES,
        defaultLang: resolveInitialLocale(),
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideClientHydration(),
  ],
};
