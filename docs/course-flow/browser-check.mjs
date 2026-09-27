// Real browser + real API. Use the isolated local environment described in README.md.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.COURSEFLOW_WEB_URL || 'http://127.0.0.1:4321';
assert(
  ['127.0.0.1', 'localhost'].includes(new URL(base).hostname),
  'Use a disposable local server',
);
const out = process.env.COURSEFLOW_BROWSER_OUTPUT || '/tmp/courseflow-browser-check';
await mkdir(out, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const checks = [];
const runtimeErrors = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
const year = new Date().getFullYear();
const planName = `Browser QA ${Date.now()}`;
let mapUrl;
let result = 'failed';
function passed(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function login(target, username) {
  await target.goto(`${base}/sign_in`);
  await target.getByRole('textbox', {name: 'Username', exact: true}).fill(username);
  await target.locator('input[name="password"]').fill('password');
  await target.getByRole('button', {name: 'Sign In', exact: true}).click();
  await target.getByRole('button', {name: 'Open account menu', exact: true}).waitFor();
}
async function ready(target) {
  await target.getByRole('heading', {name: 'Course Flow', exact: true}).waitFor();
  await target.getByLabel('Course and version', {exact: true}).waitFor();
}
async function place(code, trimester, position, targetYear = year) {
  await page.getByLabel('Unit', {exact: true}).selectOption(code);
  await page
    .getByLabel('Destination', {exact: true})
    .selectOption(`${targetYear}-${trimester}-${position}`);
  const button = page.getByRole('button', {name: 'Place or move unit', exact: true});
  await button.focus();
  await page.keyboard.press('Enter');
  await page
    .locator(`#slot-${targetYear}-${trimester}-${position}`)
    .getByRole('heading', {name: code, exact: true})
    .waitFor();
}
async function addPeriod(targetYear, trimester) {
  await page.getByLabel('Year', {exact: true}).fill(String(targetYear));
  await page.getByLabel('Trimester', {exact: true}).selectOption({label: String(trimester)});
  await page.getByRole('button', {name: 'Add period', exact: true}).click();
  await page.locator(`#slot-${targetYear}-${trimester}-1`).waitFor();
}
async function save(target) {
  const response = target.waitForResponse(
    (response) =>
      response.url().includes('/api/courseflow/maps') &&
      ['POST', 'PUT'].includes(response.request().method()),
  );
  await target.getByRole('button', {name: 'Save plan', exact: true}).click();
  const saved = await response;
  assert(saved.ok(), `Save returned ${saved.status()}`);
  await target.getByText('Saved to your account', {exact: true}).waitFor();
  return saved.json();
}
try {
  await login(page, 'student_1');
  await page.goto(`${base}/coursemap`);
  await ready(page);
  const option = await page
    .locator('#course-select option')
    .filter({hasText: 'DEMO-CF'})
    .getAttribute('value');
  assert(option, 'Import DEMO-CF sample catalog first');
  await page.getByLabel('Course and version', {exact: true}).selectOption(option);
  await page.getByLabel('Plan name', {exact: true}).fill(planName);
  const dragSource = page.locator('#required-units .unit-card').filter({
    has: page.getByRole('heading', {name: 'DEMO101', exact: true}),
  });
  const dragTarget = page.locator(`#slot-${year}-1-1`);
  await dragSource.scrollIntoViewIfNeeded();
  await dragTarget.scrollIntoViewIfNeeded();
  const sourceBox = await dragSource.boundingBox();
  const targetBox = await dragTarget.boundingBox();
  assert(sourceBox && targetBox);
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + 32, {steps: 5});
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
  await dragTarget.getByRole('heading', {name: 'DEMO101', exact: true}).waitFor();
  await page.getByRole('button', {name: 'Remove DEMO101 from plan', exact: true}).click();
  passed('actual CDK pointer drag places a unit and removal returns it to the catalog');
  await addPeriod(year, 2);
  await addPeriod(year, 3);
  await addPeriod(year + 1, 1);
  await place('DEMO101', 1, 1);
  await place('DEMO102', 2, 2);
  await place('DEMO201', 2, 3);
  await page
    .getByText('Your plan satisfies the configured planning rules.', {exact: true})
    .waitFor();
  passed('signed-in student chooses a catalog and builds a valid plan using keyboard controls');

  await place('DEMO201', 2, 2);
  await page
    .locator(`#slot-${year}-2-3`)
    .getByRole('heading', {name: 'DEMO102', exact: true})
    .waitFor();
  await place('DEMO201', 2, 3);
  await page.getByLabel('Unit', {exact: true}).selectOption('DEMO201');
  await page.getByRole('button', {name: 'Remove selected unit', exact: true}).focus();
  await page.keyboard.press('Enter');
  await page
    .locator('#elective-units')
    .getByRole('heading', {name: 'DEMO201', exact: true})
    .waitFor();
  await place('DEMO201', 2, 3);
  passed('keyboard swap, move and remove preserve the units');

  const original = await save(page);
  mapUrl = `${base}/coursemap/${original.id}`;
  await page.waitForURL(mapUrl);
  await page.reload();
  await ready(page);
  await page.getByLabel('Plan name', {exact: true}).waitFor();
  assert.equal(await page.getByLabel('Plan name', {exact: true}).inputValue(), planName);
  for (const [code, trimester, position] of [
    ['DEMO101', 1, 1],
    ['DEMO102', 2, 2],
    ['DEMO201', 2, 3],
  ]) {
    await page
      .locator(`#slot-${year}-${trimester}-${position}`)
      .getByRole('heading', {name: code, exact: true})
      .waitFor();
  }
  assert.equal(await page.locator(`#slot-${year + 1}-1-1 .empty-slot`).count(), 1);
  passed('real save and full reload restore unit positions and empty periods');

  await page.getByLabel('Plan name', {exact: true}).fill(`${planName} local edit`);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', {name: 'New plan', exact: true}).click();
  assert.equal(
    await page.getByLabel('Plan name', {exact: true}).inputValue(),
    `${planName} local edit`,
  );
  assert.equal(page.url(), mapUrl);
  passed('canceling dirty navigation preserves the current draft');

  const otherSession = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const second = await otherSession.newPage();
  await login(second, 'student_1');
  await second.goto(mapUrl);
  await ready(second);
  await second.getByLabel('Plan name', {exact: true}).fill(`${planName} other session`);
  await save(second);
  const conflict = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith(`/api/courseflow/maps/${original.id}`),
  );
  await page.getByRole('button', {name: 'Save plan', exact: true}).click();
  assert.equal((await conflict).status(), 409);
  await page.getByRole('button', {name: 'Save a copy', exact: true}).waitFor();
  assert.equal(
    await page.getByLabel('Plan name', {exact: true}).inputValue(),
    `${planName} local edit`,
  );
  const copyResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/courseflow/maps'),
  );
  await page.getByRole('button', {name: 'Save a copy', exact: true}).click();
  const copy = await (await copyResponse).json();
  assert.notEqual(copy.id, original.id);
  await page.waitForURL(`${base}/coursemap/${copy.id}`);
  await page.getByText('Saved to your account', {exact: true}).waitFor();
  passed(
    'competing session save produces a conflict and preserves local edits through Save a copy',
  );

  await page.screenshot({path: `${out}/desktop.png`, fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: `${out}/mobile.png`, fullPage: true});
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'No horizontal document overflow at 390px',
  );
  passed('planner fits a 390px viewport');

  const foreignContext = await browser.newContext();
  const foreign = await foreignContext.newPage();
  await login(foreign, 'student_2');
  await foreign.goto(mapUrl);
  await foreign
    .getByText('This course plan is unavailable or does not belong to you.', {exact: true})
    .waitFor();
  assert.equal(await foreign.getByLabel('Plan name', {exact: true}).count(), 0);
  await foreignContext.close();
  passed('another student sees an ownership error with no private plan content');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', {name: 'Delete saved plan', exact: true}).click();
  await page.waitForURL(`${base}/coursemap`);
  second.once('dialog', (dialog) => dialog.accept());
  await second.getByRole('button', {name: 'Delete saved plan', exact: true}).click();
  await second.waitForURL(`${base}/coursemap`);
  await otherSession.close();
  assert.deepEqual(runtimeErrors, [], 'No uncaught page errors');
  passed('owner deletes saved plans without uncaught browser errors');
  result = 'passed';
} catch (error) {
  await page.screenshot({path: `${out}/failure.png`, fullPage: true}).catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${out}/result.json`,
    JSON.stringify({result, base, checks, runtimeErrors}, null, 2),
  );
  await browser.close();
}
