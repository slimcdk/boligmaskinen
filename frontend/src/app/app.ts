import { Component, HostListener, inject, signal, viewChild } from '@angular/core';
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
  }

  protected onPanelToggled(): void {
    this.mapView()?.resize();
  }

  @HostListener('document:keydown.escape')
  protected cancelPlacing(): void {
    this.store.placing.set(false);
  }
}
