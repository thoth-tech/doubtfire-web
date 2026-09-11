<p align="center"> 
	<img alt="OnTrack logo" src="src/assets/icons/android-chrome-192x192.png" width="192">
</p>

# OnTrack Web [![CI](https://github.com/doubtfire-lms/doubtfire-web/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/doubtfire-lms/doubtfire-web/actions/workflows/nodejs-ci.yml)

A modern, lightweight learning management system.

## Table of Contents

- [Getting Started](#getting-started)
- [Checks](#checks)
- [Production build and handover](#production-build-and-handover)
- [Demo and live feature boundaries](#demo-and-live-feature-boundaries)
- [Resources](#resources)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

OnTrack Web requires Node.js 22.22.3 or newer. The exact handover version is in
`.nvmrc`. Clone recursively because the JPlag report viewer is a production
asset supplied by a git submodule:

```sh
git clone --recurse-submodules https://github.com/doubtfire-lms/doubtfire-web.git
cd doubtfire-web
git submodule update --init --recursive
nvm install
nvm use
npm ci
```

Run the [Doubtfire API](https://github.com/doubtfire-lms/doubtfire-api) on
`http://localhost:3000`, then start the Angular development server:

```sh
npm start
```

Open <http://localhost:4200>. `proxy.conf.json` forwards `/api` to the local API.
It also forwards `/lti/api` to the optional local LTI service on port 3001; LTI
requests will fail if that service is not running.

The legacy root `docker-compose.yml` also defaults to local database
authentication. Optional AAF development must use a dedicated non-production
registration supplied through an ignored `.env` file copied from
`.env.example`. Any AAF secret ever committed to Git must be treated as
compromised and rotated by its identity owner.

## Checks

Run the same checks required for a release before handing the branch over:

```sh
npm run verify:deployment-config
npm run lint
npm run typecheck
npm run test:ci
npm run deploy
```

## Production build and handover

The production application deliberately uses the browser origin for both API
contracts:

- `/api` must be reverse-proxied to Doubtfire API.
- `/lti/api` must be reverse-proxied to the LTI service when LTI is enabled.

`DF_API_URL` is not a runtime switch for the Angular production build. Hosting
the API on another origin requires an explicit web configuration and matching
CORS policy. Production must use HTTPS for service workers, installation, and
Web Push.

Build the static production bundle directly with:

```sh
npm ci
git submodule update --init --recursive
npm run deploy
```

Or build the production Nginx image, which is the release artifact used by the
deployment repository:

```sh
docker build -f deploy.Dockerfile -t doubtfire-web:handover .
docker run --rm -p 8080:80 doubtfire-web:handover
```

The root `Dockerfile` is the bind-mounted development image: it contains the
source tree, npm, and development dependencies so that local Compose workflows
can rebuild on startup. Do not publish or assess it as the production runtime.
Release vulnerability scans must build `deploy.Dockerfile` and scan its final
Nginx image digest; build-stage and development-image findings should be tracked
separately.

The Dockerfile pins its Node and Nginx base images by multi-architecture digest
and performs the build as the unprivileged `node` user. Refresh those digests
deliberately as part of a reviewed dependency update; do not replace them with
floating tags for a release.

Sentry is optional. Direct production builds leave it disabled. The image build
can substitute `SENTRY_DSN`, `SENTRY_RELEASE`, and `SENTRY_DIST`; source-map
upload additionally requires the documented Sentry build arguments and a
BuildKit `sentry_auth_token` secret.

Before publishing, verify the generated service-worker files and JPlag assets:

```sh
test -f dist/browser/index.html
test -f dist/browser/ngsw.json
test -f dist/browser/ngsw-worker.js
test -f dist/browser/manifest.webmanifest
test -n "$(find dist/browser/JPlag -mindepth 1 -maxdepth 1 -print -quit)"
```

Against the running image, confirm application routes fall back to `index.html`,
each named control-file URL returns 404 rather than HTML if its build output is
missing, and these files return `Cache-Control: no-store, no-cache` when present:

- `/index.html`
- `/ngsw.json`
- `/ngsw-worker.js`
- `/safety-worker.js`
- `/worker-basic.min.js`
- `/manifest.webmanifest`

The external proxy or CDN must preserve that cache policy. Pin the tested image
digest in `doubtfire-deploy`, then smoke-test sign-in, API routing, service-worker
registration/update, and any enabled LTI or Web Push integration.

## Demo and live feature boundaries

Demo source, fixtures, controls, and evidence remain in the repository for local
demonstrations. Production builds set `production: true` and
`enableDemoTools: false`; `/demo-controls` is unavailable and genuine API data
passes through unchanged. Do not change that flag from deployment tooling.

Task-level peer progress is live when the matching API feature and privacy
configuration are enabled. The unit summary and burndown peer-median displays
are explicitly demo-only fixtures. The push-notification demo preview is visual
only; real Web Push requires API VAPID configuration, HTTPS, a running worker,
and browser permission.

## Resources

Doubtfire Web is an [Angular](https://angular.dev) application using
[Angular Material](https://material.angular.dev/). Production is served as a
static progressive web application by Nginx.

## Contributing

Refer to [CONTRIBUTING.md](CONTRIBUTING.md)

## License

Licensed under GNU Affero General Public License (AGPL) v3
