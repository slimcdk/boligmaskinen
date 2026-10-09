import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { ProfileSync } from './state/profile-sync';
import { ThemeService } from './theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Use the Material Symbols font loaded in index.html for <mat-icon>
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
