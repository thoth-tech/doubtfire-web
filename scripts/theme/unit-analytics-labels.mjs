// Run against an isolated local acceptance app with synthetic convenor credentials.
// By default, test the served build. ANALYTICS_STYLE_OVERLAY=1 compiles this
// checkout's shared SCSS and overlays it on an older build; output states that mode.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE_URL || 'playwright');
const base = process.env.ACCEPTANCE_URL || 'http://localhost:4320';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use an isolated local app');
assert.ok(process.env.ACCEPTANCE_CREDENTIALS_FILE, 'Set ACCEPTANCE_CREDENTIALS_FILE');
const fixture = JSON.parse(await readFile(process.env.ACCEPTANCE_CREDENTIALS_FILE, 'utf8'));
const output = resolve(process.env.ANALYTICS_QA_OUTPUT || '/tmp/unit-analytics-theme');
await mkdir(output, {recursive: true});
const hosts = [
  'f-summary-task-status-scatter',
  'f-target-grade-pie-chart',
  'f-task-completion-box-plot',
];
const overlay = process.env.ANALYTICS_STYLE_OVERLAY === '1';
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({
  viewport: {width: 1440, height: 1000},
  reducedMotion: 'reduce',
});
page.setDefaultTimeout(40000);
const results = {
  mode: overlay ? 'compiled source SCSS overlay on served build' : 'served build',
  checks: [],
};
const setTheme = async (theme) => {
  const button = page.getByRole('button', {name: `Switch to ${theme} theme`, exact: true});
  if ((await page.locator('html').getAttribute('data-ot-theme')) !== theme) await button.click();
};
const inspect = () =>
  page.locator(hosts.join(',')).evaluateAll((cards) => {
    const luminance = (color) => {
      const rgb = color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    return cards.map((card) => {
      const background = getComputedStyle(card.querySelector('mat-card')).backgroundColor;
      const labels = [...card.querySelectorAll('.chart svg text')].map((label) => {
        const fill = getComputedStyle(label).fill;
        const a = luminance(fill),
          b = luminance(background);
        return {
          text: label.textContent.trim(),
          fill,
          contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
      const chart = card.querySelector('.chart');
      const marks = [...chart.querySelectorAll('svg [fill]')]
        .filter(
          (mark) =>
            !['none', 'currentColor'].includes(mark.getAttribute('fill')) &&
            !mark.getAttribute('fill').startsWith('url('),
        )
        .map((mark) => ({
          attribute: mark.getAttribute('fill'),
          rendered: getComputedStyle(mark).fill,
        }));
      return {
        chart: card.tagName.toLowerCase(),
        background,
        labels,
        marks,
        width: chart.clientWidth,
        svgWidth: chart.querySelector('svg').getBoundingClientRect().width,
      };
    });
  });
try {
  await page.goto(`${base}/sign_in`);
  await page.getByLabel('Username', {exact: true}).fill(fixture.convenor.username);
  await page.getByLabel('Password', {exact: true}).fill(fixture.convenor.password);
  await page.getByRole('button', {name: 'Sign In', exact: true}).click();
  await page.waitForURL((url) => !url.pathname.includes('sign_in'));
  await page.goto(`${base}/units/${fixture.unit_id}/analytics`);
  await page.locator('f-task-completion-box-plot table tbody tr').first().waitFor();
  await setTheme('dark');
  // ngx-charts has a 100ms initial D3 update and a 600ms chart fade, even when
  // data transitions are disabled. Inspect the settled SVG, not the entrance frame.
  await page.waitForTimeout(750);
  results.baselineDark = await inspect();
  if (overlay) {
    const sassModule = await import(process.env.SASS_MODULE_URL || 'sass');
    const sass = typeof sassModule.compileString === 'function' ? sassModule : sassModule.default;
    const scss = await readFile(
      new URL('../../src/app/visualisations/unit-analytics-chart.scss', import.meta.url),
      'utf8',
    );
    const css = sass.compileString(`${hosts.join(',')} { ${scss} }`).css;
    await page.addStyleTag({content: css});
  }
  for (const theme of ['dark', 'light']) {
    await page.setViewportSize({width: 1440, height: 1000});
    await setTheme(theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 1000});
      await page.waitForTimeout(750);
      assert.equal(await page.locator('html').getAttribute('data-ot-theme'), theme);
      const charts = await inspect();
      assert.equal(charts.length, 3);
      for (const chart of charts) {
        assert.deepEqual(
          chart.marks,
          results.baselineDark.find((baseline) => baseline.chart === chart.chart).marks,
          `${chart.chart} preserves explicit mark colours`,
        );
        assert.ok(chart.labels.length > 0, `${chart.chart} has rendered labels`);
        assert.ok(
          chart.labels.every((label) => label.contrast >= 4.5),
          `${theme} ${chart.chart} label contrast is at least 4.5:1`,
        );
        assert.ok(
          Math.abs(chart.svgWidth - chart.width) <= 1,
          `${chart.chart} resized to its container`,
        );
      }
      results.checks.push({theme, viewportWidth: width, charts});
      for (const host of hosts) {
        await page
          .locator(host)
          .screenshot({path: resolve(output, `${theme}-${width}-${host}.png`)});
      }
    }
  }
  results.status = 'passed';
  results.browser = browser.version();
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({
      status: results.status,
      mode: results.mode,
      browser: results.browser,
      checks: results.checks.length,
      output,
    }),
  );
} finally {
  await browser.close();
}
