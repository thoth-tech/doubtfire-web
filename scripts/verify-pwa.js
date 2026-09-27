// Verify source assets, or the deployable Angular output with --dist <directory>.
// Browser installation and institutional SSO still require the documented smoke test.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');

const root = resolve(__dirname, '..');
const args = process.argv.slice(2);
assert(
  args.length === 0 || (args.length === 2 && args[0] === '--dist'),
  'Usage: node scripts/verify-pwa.js [--dist dist/browser]',
);
const built = args.length > 0;
const assets = built ? resolve(root, args[1]) : resolve(root, 'src');
const read = (path) => readFileSync(resolve(assets, path.replace(/^\//, '')));
const manifest = JSON.parse(read('manifest.webmanifest'));
const origin = 'https://ontrack.example';
const localPath = (value) => {
  const url = new URL(value, origin);
  assert.equal(url.origin, origin, `PWA URL must be same-origin: ${value}`);
  assert(!url.search && !url.hash, `PWA URL must not contain credentials or tracking: ${value}`);
  return url.pathname;
};

// Existing installations used start_url as their implicit id. Preserve both.
assert.equal(manifest.id, '/index.html', 'Preserve the identity of existing installations');
assert.equal(manifest.start_url, '/index.html');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.prefer_related_applications, false);
assert(manifest.name && manifest.short_name && manifest.description);
assert.match(read('index.html').toString(), /href="\/manifest.webmanifest"\s+rel="manifest"/);

for (const size of [192, 512]) {
  assert(
    manifest.icons.some(
      (icon) =>
        icon.sizes === `${size}x${size}` &&
        (!icon.purpose || icon.purpose.split(' ').includes('any')),
    ),
    `Missing general-purpose ${size}px app icon`,
  );
}
assert(manifest.icons.some((icon) => icon.purpose?.split(' ').includes('maskable')));
for (const icon of manifest.icons) {
  assert.equal(icon.type, 'image/png');
  const bytes = read(localPath(icon.src));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${icon.src} must be PNG`);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
}
assert.deepEqual(
  manifest.shortcuts.map((entry) => localPath(entry.url)),
  ['/home', '/notifications', '/unit-hub'],
);
const routes = readFileSync(resolve(root, 'src/app/app.routes.ts'), 'utf8');
for (const shortcut of manifest.shortcuts) {
  assert(shortcut.name);
  assert(
    routes.includes(`path: '${localPath(shortcut.url).slice(1)}'`),
    `Shortcut has no Angular route: ${shortcut.url}`,
  );
}

const swConfig = JSON.parse(readFileSync(resolve(root, 'ngsw-config.json'), 'utf8'));
assert(swConfig.navigationUrls.includes('!/api'));
assert(swConfig.navigationUrls.includes('!/api/**'));
assert(
  swConfig.assetGroups.some(
    (group) =>
      group.installMode === 'prefetch' && group.resources.files?.includes('/manifest.webmanifest'),
  ),
);
const angular = JSON.parse(readFileSync(resolve(root, 'angular.json'), 'utf8'));
assert.equal(
  angular.projects.doubtfire.architect.build.configurations.production.serviceWorker,
  'ngsw-config.json',
);

if (built) {
  const sw = JSON.parse(read('ngsw.json'));
  assert.equal(sw.index, '/index.html');
  assert(read('ngsw-worker.js').length > 1000, 'Angular worker must be present');
  const files = new Set([
    '/index.html',
    '/manifest.webmanifest',
    ...manifest.icons.map((icon) => localPath(icon.src)),
    ...sw.assetGroups
      .filter((group) => group.installMode === 'prefetch')
      .flatMap((group) => group.urls),
  ]);
  for (const file of files) {
    assert.equal(
      createHash('sha1').update(read(file)).digest('hex'),
      sw.hashTable[file],
      `Missing or stale service-worker hash for ${file}`,
    );
  }
  const routesToCheck = [
    ['/home', true],
    ['/notifications', true],
    ['/unit-hub', true],
    ['/api', false],
    ['/api/d2l/callback', false],
    ['/api/projects/123', false],
    ['/sidekiq', false],
    ['/JPlag/report', false],
  ];
  for (const [path, expected] of routesToCheck) {
    const positive = sw.navigationUrls.some(
      (entry) => entry.positive && new RegExp(entry.regex).test(path),
    );
    const excluded = sw.navigationUrls.some(
      (entry) => !entry.positive && new RegExp(entry.regex).test(path),
    );
    assert.equal(
      positive && !excluded,
      expected,
      `Incorrect service-worker navigation fallback: ${path}`,
    );
  }
}
console.log(`PWA ${built ? 'production build' : 'source'} verification passed.`);
