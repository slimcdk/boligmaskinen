import { Component, effect, HostListener, inject, signal, untracked, viewChild } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { PilotData } from './data/pilot-data';
import { Legend } from './legend/legend';
import { MapView } from './map/map-view';
import { Panel } from './panel/panel';
import { Store } from './state/store';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatIconModule, MatSidenavModule, MapView, Panel, Legend],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly data = inject(PilotData);
  protected readonly store = inject(Store);
  private readonly mapView = viewChild(MapView);

  protected readonly mobile = toSignal(
    inject(BreakpointObserver).observe('(max-width: 700px)').pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly panelOpen = signal(!window.matchMedia('(max-width: 700px)').matches);

  constructor() {
    void this.data.load();
    // On a phone the panel lies over the map: it steps aside while a place is dropped, and comes back after
    let stepAside = false;
    effect(() => {
      const placing = this.store.placing();
      untracked(() => {
        if (placing && this.mobile() && this.panelOpen()) {
          stepAside = true;
          this.panelOpen.set(false);
        } else if (!placing && stepAside) {
          stepAside = false;
          this.panelOpen.set(true);
        }
      });
    });
  }

  protected onPanelToggled(): void {
    this.mapView()?.resize();
  }

  @HostListener('document:keydown.escape')
  protected cancelPlacing(): void {
    this.store.placing.set(false);
  }
}
