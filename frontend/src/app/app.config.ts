import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { I18n, provideI18n } from './i18n/i18n';
import { ProfileSync } from './state/profile-sync';
import { ThemeService } from './theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideI18n(),
    // The language before the first render: the viewer's choice, or the browser's
    provideAppInitializer(() => {
      inject(I18n);
    }),
    // Material Symbols (Outlined), served with the app (angular.json), for <mat-icon>
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
    // Apply the viewer's light or dark choice before the first render
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // The saved maps load from the server in the background; the app starts with this browser's copy
    provideAppInitializer(() => {
      void inject(ProfileSync).start();
    }),
  ],
};
