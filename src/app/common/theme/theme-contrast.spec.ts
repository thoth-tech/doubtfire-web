import {describe, expect, it} from 'vitest';

// The spec bundle cannot import node:fs, so reach the built-in at run time. Vitest
// runs these specs in Node with the repository root as the working directory.
interface NodeProcess {
  cwd(): string;
  getBuiltinModule(id: 'node:fs'): {readFileSync(path: string, enc: 'utf8'): string};
}
const nodeProcess = (globalThis as unknown as {process: NodeProcess}).process;

function readTokenFile(file: string): string {
  const fs = nodeProcess.getBuiltinModule('node:fs');
  return fs.readFileSync(`${nodeProcess.cwd()}/src/styles/tokens/${file}`, 'utf8');
}

/**
 * Contrast guard for the --ot-* token layer. Reads the two token files, resolves any
 * var() reference to a real colour, and checks each text/surface and control/surface
 * pair against WCAG 2.2 AA in both themes. Every result must be a finite number, so a
 * value the parser cannot read fails the spec instead of passing as NaN.
 */

type Tokens = Record<string, string>;
type Rgb = [number, number, number];

function readTokens(src: string): Tokens {
  const out: Tokens = {};
  for (const m of src.matchAll(/^\s*(--ot-[\w-]+)\s*:\s*([^;]+);/gm)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

function resolve(tokens: Tokens, name: string, depth = 0): string {
  const value = tokens[name];
  if (value === undefined) {
    throw new Error(`missing token ${name}`);
  }
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (ref) {
    if (depth > 10) {
      throw new Error(`var() cycle at ${name}`);
    }
    return resolve(tokens, ref[1], depth + 1);
  }
  return value;
}

function hex(value: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  if (!m) {
    throw new Error(`not a 6-digit hex colour: ${value}`);
  }
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const light = readTokens(readTokenFile('_light.scss'));
const themes: Record<string, Tokens> = {
  light,
  dark: {...light, ...readTokens(readTokenFile('_dark.scss'))},
};

const surfaces = ['--ot-color-page', '--ot-color-surface', '--ot-color-surface-raised'];
const bodyText = [
  '--ot-color-text',
  '--ot-color-text-muted',
  '--ot-color-link',
  '--ot-color-success',
  '--ot-color-warning',
  '--ot-color-error',
  '--ot-color-info',
  '--ot-urgency-overdue',
  '--ot-urgency-soon',
  '--ot-urgency-later',
  '--ot-chart-axis',
];
const nonText = ['--ot-color-control-border', '--ot-color-focus'];

const cases: {theme: string; fg: string; bg: string; min: number}[] = [];
for (const theme of Object.keys(themes)) {
  for (const bg of surfaces) {
    bodyText.forEach((fg) => cases.push({theme, fg, bg, min: 4.5}));
    nonText.forEach((fg) => cases.push({theme, fg, bg, min: 3}));
  }
  const keys = Object.keys(themes[theme]);
  keys
    .filter((k) => /^--ot-status-[\w-]+-on$/.test(k))
    .forEach((fg) => cases.push({theme, fg, bg: fg.replace(/-on$/, ''), min: 4.5}));
  keys
    .filter((k) => /^--ot-status-[\w-]+-graphic$/.test(k))
    .forEach((fg) => {
      cases.push({theme, fg, bg: '--ot-color-surface', min: 3});
      cases.push({theme, fg, bg: '--ot-color-surface-raised', min: 3});
    });
  [
    ['--ot-color-on-primary', '--ot-color-primary'],
    ['--ot-color-on-warning', '--ot-color-warning'],
    ['--ot-color-on-error', '--ot-color-error'],
    ['--ot-color-inverse-text', '--ot-color-inverse-surface'],
    ['--ot-color-selected-text', '--ot-color-selected'],
    ['--ot-code-text', '--ot-code-surface'],
  ].forEach(([fg, bg]) => cases.push({theme, fg, bg, min: 4.5}));
}

describe('theme token contrast', () => {
  it('computes real numbers', () => {
    expect(contrastRatio(hex('#000000'), hex('#ffffff'))).toBeCloseTo(21, 5);
    expect(contrastRatio(hex('#767676'), hex('#ffffff'))).toBeCloseTo(4.54, 2);
    expect(cases.length).toBeGreaterThan(100);
  });

  it.each(cases)('$theme: $fg on $bg clears $min:1', ({theme, fg, bg, min}) => {
    const tokens = themes[theme];
    const ratio = contrastRatio(hex(resolve(tokens, fg)), hex(resolve(tokens, bg)));
    expect(Number.isFinite(ratio)).toBe(true);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });
});
