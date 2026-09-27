import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {compile} from 'sass';
import {describe, expect, it} from 'vitest';

const index = readFileSync('src/index.html', 'utf8');
const parsedPage = new JSDOM(index);
const bootScript = parsedPage.window.document.querySelector('script:not([src])')?.textContent;
parsedPage.window.close();
const tokens = (mode: string): Record<string, string> =>
  Object.fromEntries(
    [
      ...readFileSync(`src/styles/tokens/_${mode}.scss`, 'utf8').matchAll(
        /(--ot-[\w-]+):\s*(#[\da-f]{6});/gi,
      ),
    ].map(([, name, value]) => [name, value]),
  );

function boot(stored: string | null, dark: boolean, blocked = false, mediaAvailable = true) {
  const attributes: Record<string, string> = {};
  const style = {colorScheme: ''};
  const meta = {content: '', setAttribute: (_: string, value: string) => (meta.content = value)};
  runInNewContext(bootScript!, {
    window: mediaAvailable ? {matchMedia: () => ({matches: dark})} : {},
    localStorage: {
      getItem: (key: string) => {
        expect(key).toBe('ontrack.theme.preference');
        if (blocked) {
          throw new Error('storage unavailable');
        }
        return stored;
      },
    },
    document: {
      documentElement: {
        style,
        setAttribute: (name: string, value: string) => (attributes[name] = value),
      },
      querySelector: () => meta,
    },
  });
  return {resolved: attributes['data-ot-theme'], scheme: style.colorScheme, color: meta.content};
}

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const linear = hex
      .slice(1)
      .match(/../g)!
      .map((part) => {
        const channel = Number.parseInt(part, 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('first paint before Angular loads', () => {
  it.each([
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
    [null, true, 'dark'],
    ['invalid', true, 'dark'],
    ['', false, 'light'],
  ])('resolves stored %s and OS dark=%s', (stored, dark, resolved) => {
    expect(boot(stored as string | null, dark as boolean)).toEqual({
      resolved,
      scheme: resolved,
      color: tokens(resolved as string)['--ot-color-page'],
    });
  });
  it('still paints System when localStorage is blocked', () => {
    expect(boot('light', true, true).resolved).toBe('dark');
  });
  it('falls back to Light when matchMedia is unavailable', () => {
    expect(boot(null, true, false, false).resolved).toBe('light');
  });
  it('runs before styles and has browser metadata available synchronously', () => {
    expect(index.indexOf('name="theme-color"')).toBeLessThan(index.indexOf('<script>'));
    expect(index.indexOf('<script>')).toBeLessThan(index.indexOf('rel="stylesheet"'));
  });
});

describe('special surface palette', () => {
  const css = compile('src/styles/_theme-special-surfaces.scss', {
    loadPaths: ['node_modules', 'src/styles'],
    logger: {warn: () => {}},
  }).css;

  it('compiles the calendar public theme API and Gantt public variables', () => {
    expect(css).toMatch(/:root \.cal-week-view[^}]*background-color: var\(--ot-color-surface\)/);
    expect(css).toContain('--gantt-color-background: var(--ot-color-surface)');
    expect(css).toContain('stroke: var(--ot-chart-grid)');
  });
  it('overrides dark root tokens for print without persisting another preference', () => {
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toContain(':root[data-ot-theme=dark]');
    expect(print).toContain(`--ot-color-page: ${tokens('light')['--ot-color-page']}`);
    expect(print).toContain(`--ot-color-text: ${tokens('light')['--ot-color-text']}`);
    expect(print).toContain('color-scheme: light');
  });
  it.each(['light', 'dark'])('%s text, links and actions meet AA contrast on surfaces', (mode) => {
    const palette = tokens(mode);
    for (const text of ['--ot-color-text', '--ot-color-text-muted', '--ot-color-link']) {
      for (const surface of [
        '--ot-color-page',
        '--ot-color-surface',
        '--ot-color-surface-raised',
      ]) {
        expect(
          contrast(palette[text], palette[surface]),
          `${mode} ${text}/${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const boundary of ['--ot-color-focus', '--ot-color-border']) {
      for (const surface of [
        '--ot-color-page',
        '--ot-color-surface',
        '--ot-color-surface-raised',
      ]) {
        expect(
          contrast(palette[boundary], palette[surface]),
          `${mode} ${boundary}/${surface}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
    expect(
      contrast(palette['--ot-color-primary'], palette['--ot-color-on-primary']),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('task dashboard enabled-tab contrast', () => {
  const css = compile(
    'src/app/projects/states/dashboard/directives/task-dashboard/task-dashboard.component.scss',
    {loadPaths: ['node_modules'], logger: {warn: () => {}}},
  ).css;
  const header = css.match(/\.task-dashboard-tabs \.mat-mdc-tab-header\s*\{([^}]+)\}/)?.[1] ?? '';
  const tabTokens = Object.fromEntries(
    [...header.matchAll(/(--mat-tab-[\w-]+):\s*var\((--ot-[\w-]+)\)/g)].map(
      ([, token, paletteToken]) => [token, paletteToken],
    ),
  );
  const labelTokens = [
    '--mat-tab-active-label-text-color',
    '--mat-tab-active-focus-label-text-color',
    '--mat-tab-active-hover-label-text-color',
    '--mat-tab-inactive-label-text-color',
    '--mat-tab-inactive-focus-label-text-color',
    '--mat-tab-inactive-hover-label-text-color',
  ];

  it('compiles component-scoped active/inactive colors without overriding disabled opacity', () => {
    for (const label of labelTokens) {
      expect(tabTokens[label], label).toBeDefined();
    }
    expect(css).not.toMatch(/opacity\s*:/);
  });

  it.each(['light', 'dark'])(
    '%s enabled labels and selection indicators meet contrast targets',
    (mode) => {
      const palette = tokens(mode);
      for (const surface of [
        '--ot-color-page',
        '--ot-color-surface',
        '--ot-color-surface-raised',
      ]) {
        for (const label of labelTokens) {
          const foreground = palette[tabTokens[label]];
          expect(foreground, label).toBeDefined();
          expect(
            contrast(foreground, palette[surface]),
            `${mode} ${label}/${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        for (const state of ['active', 'active-focus', 'active-hover']) {
          const indicator = palette[tabTokens[`--mat-tab-${state}-indicator-color`]];
          expect(indicator, state).toBeDefined();
          expect(
            contrast(indicator, palette[surface]),
            `${mode} ${state}/${surface}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );

  it('detects the original dark active-label contrast failure', () => {
    expect(contrast('#5457e5', '#171b21')).toBeLessThan(4.5);
  });
});
