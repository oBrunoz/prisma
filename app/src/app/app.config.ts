import {
  ApplicationConfig,
  LOCALE_ID,
  provideAppInitializer,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { AuthService } from './core/services/auth.service';
import { TituloStrategy } from './core/titulo.strategy';

registerLocaleData(localePt, 'pt-BR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: TituloStrategy },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, loadingInterceptor])),
    provideAppInitializer(() => inject(AuthService).restaurarSessao()),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
  ],
};
