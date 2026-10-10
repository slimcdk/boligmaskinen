import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { versionLabel } from '../data/build-info';
import { I18n } from '../i18n/i18n';
import { AboutDialog, SOURCES } from './about-dialog';

describe('versionLabel', () => {
  const source = 'https://github.com/owner/boligmaskinen';
  it('shows the release, then the commit, then says it is a local build, and links to the repository', () => {
    const i18n = TestBed.inject(I18n);
    const t = i18n.t.bind(i18n);
    expect(versionLabel({ version: 'v1.2.0', revision: 'abcdef1234567', source, created: '2026-10-07T15:00:00Z' }, t))
      .toEqual({ text: 'v1.2.0', url: source, title: 'Release v1.2.0 · built 2026-10-07' });
    expect(versionLabel({ version: '', revision: 'abcdef1234567', source, created: '' }, t))
      .toEqual({ text: 'abcdef1', url: source, title: 'Commit abcdef1' });
    expect(versionLabel({ version: '', revision: '', source: '', created: '' }, t).text).toBe('local build');
    expect(versionLabel(null, t)).toEqual({ text: 'local build', url: null, title: 'Built locally, not from git' });
    i18n.use('da');
    expect(versionLabel(null, t)).toEqual({ text: 'lokalt build', url: null, title: 'Bygget lokalt, ikke fra git' });
    i18n.use('en');
  });
});

describe('AboutDialog', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AboutDialog] });
  });

  it('explains the map, and gives every source a section with its licence and credit', () => {
    const fixture = TestBed.createComponent(AboutDialog);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('How the map is made');
    const sections = [...element.querySelectorAll<HTMLElement>('.source')];
    expect(sections.map((s) => s.querySelector('h4')!.textContent)).toEqual(SOURCES.map((s) => s.name));
    const osm = sections[0];
    expect(osm.querySelector('.credit')!.textContent).toBe('© OpenStreetMap contributors');
    expect(osm.querySelector<HTMLAnchorElement>('dd a')!.href).toBe('https://www.openstreetmap.org/copyright');
    const links = [...element.querySelectorAll<HTMLAnchorElement>('.sources a')];
    // Sources link to their sites; the licence texts of the fonts and icons are served from here
    expect(links.every((a) => (a.href.startsWith('https://') || a.href.startsWith(location.origin)) && a.target === '_blank' && a.rel === 'noopener')).toBe(true);
    const texts = links.filter((a) => ['Noto fonts', 'Icons', 'Roboto', 'Material Symbols'].includes(a.textContent!.trim())).map((a) => a.href.replace(location.origin, ''));
    expect(texts).toEqual(['/data-pack/licences/noto-fonts-OFL.txt', '/data-pack/licences/icons-MIT.md', '/licences/roboto/LICENSE', '/licences/material-symbols/LICENSE']);
    // One row each, with a divider between them
    expect(element.querySelectorAll('.sources mat-divider')).toHaveLength(SOURCES.length - 1);
    // Every source is credited, and one without terms says so
    expect(SOURCES.every((s) => s.credit && s.licence.name)).toBe(true);
    expect(sections.find((s) => s.textContent!.includes('Dagtilbudsregisteret'))!.textContent).toContain('No licence stated');
  });
});
