const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');

const root = resolve(__dirname, '..');
const nginx = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
const dockerfile = readFileSync(resolve(root, 'deploy.Dockerfile'), 'utf8');
const developmentCompose = readFileSync(resolve(root, 'docker-compose.yml'), 'utf8');
const deploymentWorkflows = [
  ['default', readFileSync(resolve(root, '.github/workflows/deployment.yml'), 'utf8')],
  [
    'institution',
    readFileSync(resolve(root, '.github/workflows/deployment-institution.yml'), 'utf8'),
  ],
];
const applicationBootstrap = readFileSync(resolve(root, 'src/main.ts'), 'utf8');
const scormPlayerTemplate = readFileSync(
  resolve(root, 'src/app/common/scorm-player/scorm-player.component.html'),
  'utf8',
);
const productionEnvironment = readFileSync(
  resolve(root, 'src/environments/environment.prod.ts'),
  'utf8',
);

const controlFiles = [
  '/index.html',
  '/ngsw.json',
  '/ngsw-worker.js',
  '/safety-worker.js',
  '/worker-basic.min.js',
  '/manifest.webmanifest',
];
const noStorePolicy = 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const path of controlFiles) {
  const escapedPath = escapeRegExp(path);

  assert.match(
    nginx,
    new RegExp(`^\\s*${escapedPath}\\s+"${noStorePolicy}";`, 'm'),
    `${path} must map to the no-store cache policy`,
  );
  assert.match(
    nginx,
    new RegExp(`location = ${escapedPath} \\{\\s*try_files \\$uri =404;\\s*\\}`, 'm'),
    `${path} must use an exact location and return 404 when absent`,
  );
}

assert.match(
  nginx,
  /add_header Cache-Control \$ontrack_control_file_cache_control always;/,
  'the mapped cache policy must be added to responses',
);
assert.match(
  nginx,
  /try_files \$uri \$uri\/ \$uri\/index\.html \/index\.html;/,
  'SPA routes must continue to fall back to /index.html',
);
for (const [name, workflow] of deploymentWorkflows) {
  assert.doesNotMatch(
    workflow,
    /steps\.meta\.outputs\.labels/,
    `${name} deployment metadata labels must reference the declared docker_meta step`,
  );
  assert.match(workflow, /steps\.docker_meta\.outputs\.labels/);

  for (const line of workflow.split('\n')) {
    if (/^\s*uses:/.test(line)) {
      assert.match(
        line,
        /@[0-9a-f]{40}(?:\s+#.*)?$/,
        `${name} production image workflow actions must be pinned to immutable commits`,
      );
    }
  }

  assert.match(workflow, /^\s*sbom:\s*true$/m);
  assert.match(workflow, /^\s*provenance:\s*mode=max$/m);
}
assert.match(
  dockerfile,
  /^FROM node:22\.23\.2-bookworm-slim@sha256:[0-9a-f]{64} AS build$/m,
  'the release build must pin the supported Node image digest',
);
assert.match(
  dockerfile,
  /npm install --global npm@11\.19\.1/,
  'the release build must install the reviewed npm security update',
);
assert.match(
  dockerfile,
  /^FROM nginx:1\.30\.4-alpine@sha256:[0-9a-f]{64}$/m,
  'the release runtime must pin the Nginx image digest',
);
assert.match(
  dockerfile,
  /^RUN apk upgrade --no-cache libcrypto3 libssl3$/m,
  'the release runtime must install the reviewed Alpine OpenSSL security update',
);
assert.doesNotMatch(
  dockerfile,
  /npm ci[^\n]*--force/,
  'the release build must not force npm resolution',
);
assert.doesNotMatch(
  dockerfile,
  /chmod\s+777/,
  'the release build must not create world-writable source',
);
assert.match(
  developmentCompose,
  /DF_SECRET_KEY_AAF:\s*\$\{DF_SECRET_KEY_AAF:-\}/,
  'optional development AAF credentials must come from the ignored environment',
);
assert.doesNotMatch(
  developmentCompose,
  /https?:\/\/[^\s$]*(?:aaf\.edu\.au|deakin\.edu\.au)/i,
  'institution-specific AAF endpoints must not be committed in development Compose',
);
assert.doesNotMatch(
  applicationBootstrap,
  /(?:browserTracingIntegration|replayIntegration|tracesSampleRate|replaysSessionSampleRate|replaysOnErrorSampleRate)/,
  'tracing and replay must stay disabled while SCORM uses credential-bearing paths',
);
assert.match(
  applicationBootstrap,
  /enableLogs:\s*false/,
  'Sentry Logs must stay disabled for the errors-only telemetry policy',
);
assert.match(
  scormPlayerTemplate,
  /<iframe[^>]*data-sentry-block[^>]*referrerpolicy="no-referrer"/,
  'the SCORM iframe must suppress referrers and remain blocked from any future replay integration',
);
assert.match(
  productionEnvironment,
  /enableDemoTools:\s*false/,
  'production must keep demo tools disabled',
);

console.log('Deployment configuration checks passed.');
