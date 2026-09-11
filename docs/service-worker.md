# The service worker in development

Push notifications are received by a service worker. Until MN-F03, the service
worker only ran in production builds, so **no push could ever arrive while
developing** and nobody could test any push work.

This describes what changed, what it costs, and how to get out of trouble.

## What changed

Two halves. Doing only one of them leaves the app worse than before.

1. **`angular.json`** — the `development` build configuration now sets
   `"serviceWorker": "ngsw-config.json"`. Before this it was set only on
   `production`, so a development build never generated `ngsw-worker.js` at all.
2. **`doubtfire-angular.module.ts`** — `ServiceWorkerModule.register` now reads
   `environment.production || environment.enableServiceWorker` instead of
   `environment.production`.

Order matters. Flipping the flag without the first half leaves the app asking the
server for a file that does not exist. That fails quietly and looks exactly like
push being broken.

## Turning it off

`src/environments/environment.ts`:

```ts
enableServiceWorker: false,
```

Then reload with the worker cleared (below). Production is unaffected either way,
because `production: true` already enables it.

## Which build configuration is actually in use

`package.json` runs `ng serve --configuration $NODE_ENV`, so **the configuration
depends on an environment variable and is not necessarily `development`.**
"I added it to `development`" does not mean `development` is the one running.

Check what `$NODE_ENV` is:

    docker exec doubtfire-web printenv NODE_ENV

In the Docker stack it is `docker`. That is a **serve** configuration in
`angular.json`, and it maps to the `development` **build** configuration:

```json
"docker": { "buildTarget": "doubtfire:build:development" }
```

So the change does apply in Docker. If you add another serve configuration, point
it at a build configuration that has `serviceWorker` set, or push silently stops
working for anyone using it.

## Registration is delayed six seconds

`doubtfire-angular.module.ts` sets:

```ts
registrationStrategy: () => interval(6000).pipe(take(1)),
```

The worker registers **six seconds after bootstrap**, not at bootstrap. Anything
that asks for the service worker during app init finds nothing there. Wait on
`navigator.serviceWorker.ready` rather than assuming it exists — MN-C01 depends
on this.

## What it costs

**Measured** on the Docker stack, Angular 22, `ng serve`:

- `ngsw-worker.js` and `ngsw.json` are served (they were 404 before). The dev
  server generates them, so no separate `ng build` step is needed.
- `ngsw.json` lists 158 hashed files, and the `app` asset group prefetches
  `/index.html`, `/main.js`, `/styles.css`, `/polyfills.js` and `/scripts.js`.
  **The whole app bundle is cached.**
- A source change does regenerate the manifest: after editing a file under `src/`
  the `/main.js` hash in `ngsw.json` changed, so the worker can see there is an
  update.
- API calls are not cached. The `api` data group in `ngsw-config.json` uses
  `"strategy": "freshness"` with `maxAge: 0u` and `maxSize: 0`.

**Confirmed in a browser** on 2026-08-02: the worker registers, and a push sent
from the api arrives as a desktop notification. So the two halves above are
enough to make push work in development.

What still has not been measured is how live reload behaves once the worker is
serving from its cache over a long session. Angular's worker normally picks up a
new version on a later page load rather than the current one, which would mean
**after saving a file you reload and still see the old code**. Treat that as
expected until somebody hits it.

The cost to watch for is stale app code, not stale data — API responses are not
cached. If something you just changed is not showing up, clear the worker before
assuming the change is wrong.

## Push subscription rotation

Angular 22's worker handles the browser's `pushsubscriptionchange` event and
forwards it through `SwPush.pushSubscriptionChanges`. The app starts that
listener with its other push lifecycle services. When the browser supplies a
replacement, the app POSTs it to `/api/push_subscriptions` first and removes the
old endpoint only after the replacement is stored. A keys-only rotation keeps
the same endpoint and updates the existing api row in place.

The focused service tests simulate this event because browsers do not provide a
reliable way to force a real rotation. They verify the POST-before-DELETE order,
keys-only updates, teardown, and that one failed api request does not stop later
rotations. A change event with no replacement cannot be repaired automatically:
creating a fresh subscription may require a user gesture, so the user must use
the existing opt-in control again; the api removes the dead row after a failed
delivery.

## Clearing a stuck service worker

Fastest, in the browser console:

```js
(await navigator.serviceWorker.getRegistrations()).forEach((r) => r.unregister());
const keys = await caches.keys();
await Promise.all(keys.map((k) => caches.delete(k)));
location.reload();
```

Through dev tools instead:

1. Application → Service Workers → **Unregister**.
2. Application → Storage → **Clear site data**.
3. Reload.

While actively working on the app, Application → Service Workers → **Bypass for
network** stops the worker serving cached responses without unregistering it. A
normal hard reload is not enough on its own, because the worker still intercepts.

## Checking it is working

    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4200/ngsw-worker.js

200 is what you want. 404 means the build configuration in use has no
`serviceWorker` entry — see "Which build configuration is actually in use".

In the browser: dev tools → Application → Service Workers. It should be
registered and activated roughly six seconds after the page loads.

Then follow `doubtfire-api/docs/notifications/push-setup.md` to register the
browser and send a push.
