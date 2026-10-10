import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { I18n } from '../i18n/i18n';
import { Texts } from '../i18n/texts';
import { ConfirmDialog, ConfirmDialogData } from '../panel/confirm-dialog';
import { ShareDialog, ShareDialogData } from '../panel/share-dialog';
import { decodeShare, encodeShare, placesUsed } from './share';
import { Store } from './store';

const SHARE = /(?:^#|&)share=([A-Za-z0-9_-]+)/;

/** Sharing a map as a link, and adding a map from one (share.ts). */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(I18n);
  private readonly texts = inject(Texts);

  /** Shows the link to the open map, with the view the map shows it in. */
  async shareOpenMap(): Promise<void> {
    const map = this.store.map();
    const code = await encodeShare(map, this.store.places(), this.store.view());
    // The map's position goes along, as MapLibre keeps it in the address
    const position = /(?:^#|&)(map=[^&]*)/.exec(location.hash)?.[1];
    const link = `${location.origin}${location.pathname}#${position ? `${position}&` : ''}share=${code}`;
    const data: ShareDialogData = { name: this.texts.mapName(map.name), link, places: placesUsed(map, this.store.places()).map((p) => p.name) };
    this.dialog.open(ShareDialog, { data, width: '560px', maxWidth: '92vw' });
  }

  /** When the page was opened from a link to a map, offers to add it. */
  async openLink(): Promise<void> {
    const code = SHARE.exec(location.hash)?.[1];
    if (!code) return;
    // The link's map is taken once; reloading the page does not offer it again
    history.replaceState(history.state, '', location.href.replace(/(#|&)share=[A-Za-z0-9_-]+/, '').replace(/#&/, '#').replace(/#$/, ''));
    let shared;
    try {
      shared = await decodeShare(code);
    } catch (error) {
      const message = (error as Error).message;
      this.snackBar.open(this.i18n.phrase('errors', message) ?? message, this.i18n.t('common.ok'), { duration: 8000 });
      return;
    }
    const blocks = shared.blocks.length;
    const places = shared.places.map((p) => p.name);
    const t = (key: string) => this.i18n.t(key, { n: blocks, places: places.join(', ') });
    const data: ConfirmDialogData = {
      title: this.i18n.t('share.addTitle', { name: this.texts.mapName(shared.name) }),
      text: t(blocks === 1 ? 'share.addBlock' : 'share.addBlocks') + (places.length ? t(places.length === 1 ? 'share.addPlace' : 'share.addPlaces') : '') + t('share.addRest'),
      action: this.i18n.t('share.addAction'),
    };
    this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data, width: '440px', maxWidth: '92vw' })
      .afterClosed().subscribe((yes) => yes && this.store.addShared(shared));
  }
}
