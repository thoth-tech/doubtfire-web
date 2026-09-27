# OnTrack desktop app

OnTrack uses the same installable PWA on desktop and mobile. It opens in an app
window, has an operating-system launcher icon, and receives the existing web
releases. No separate executable, app store, desktop API, or database migration
is needed. Deploy the production web build to the existing HTTPS origin.

## Install and use

Open your institution's OnTrack address. Select **Install OnTrack** below the
sign-in form or in the account menu. When the browser offers installation, the
dialog's Install button opens its confirmation. Otherwise, the dialog provides
manual browser instructions. Opening or closing help never installs the app.

| Desktop browser                    | Installation                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Chrome on Windows, macOS or Linux  | Address-bar install icon, or menu → Cast, save and share → Install page as app                                 |
| Edge on Windows or macOS           | Address-bar app icon, or menu → Apps → Install this site as an app; availability on other platforms varies     |
| Safari on macOS Sonoma 14 or newer | File → Add to Dock (or Share → Add to Dock)                                                                    |
| Firefox on Windows                 | Supported versions offer web apps through the address bar; Firefox 143+, or 150+ for the Microsoft Store build |
| Other browsers/platforms           | Use the website normally, or open the same address in a browser above                                          |

Browser menu wording and enterprise policies can vary. A missing in-page Install
button does not prove installation is impossible: Safari and Firefox do not use
the Chromium `beforeinstallprompt` flow. A tab also cannot reliably discover an
installation made in another browser/profile. The app recognises standalone
windows and the current browser's `appinstalled` event; it does not store a
permanent installed flag that becomes stale after uninstall.

Launch OnTrack from Start, the Dock/Applications, or your desktop environment's
app launcher. You may need to sign in again, especially in Safari's separate web
app storage. Existing account roles and access rules apply. Where the browser and
OS support manifest shortcuts, right-click the app icon for Home, Notifications
and Unit Hub. Pinning, shortcut placement, and opening external links are managed
by the browser/OS. Remove the app through the browser's app management or OS;
uninstalling the app does not delete your OnTrack account.

Mobile users retain Android install and iPhone/iPad Share → Add to Home Screen
instructions in the same dialog.

## Connection, updates and notifications

Installation caches application code, not a complete offline learning system.
Sign-in, current unit/task data, submissions, downloads and server actions need a
working connection. The status message appears when the browser reports offline;
it does not certify that the API is reachable when the browser reports online.
Submissions are not queued for automatic upload. A first visit requires a
connection, and browsers may evict the cache. Reconnect and reload if the cached
shell cannot finish loading.

The existing update service checks after application stability and every four
hours. A downloaded release offers **Reload**; save/submit any work before using
it. Failed background checks while offline are handled and later polling
continues. Angular's worker also checks on navigation. There is no forced reload
when the connection returns.

For recovery, rebuild the previous source as a new release with a freshly
generated Angular service-worker manifest. Restoring an identical older image
can leave clients on the newer cached release because Angular ignores manifest
versions it already knows. Publish the complete recovery build, preserve app
identity, and verify the Reload notice actually returns an existing client to
the intended version. The companion deployment runbook covers this procedure.

Push notifications reuse the API's current Web Push setup and the user's opt-in
settings. Installing does not grant notification permission or configure VAPID
keys. Delivery depends on browser/OS settings and background-process policies;
the app does not promise delivery when the browser is completely shut down.

## Implementation and release

- `src/manifest.webmanifest` keeps `start_url` and sets the explicit `id` to
  `/index.html`, matching the previous implicit identity. Keep these stable to
  prevent duplicate mobile or desktop apps. Scope remains `/`; subpath hosting
  would require a separate routing, asset and service-worker design.
- The existing 192px, 512px and maskable icons are reused. All shortcuts stay on
  the same origin and contain no account identifiers or credentials.
- `PwaInstallService` is constructed by the root NgModule to catch early browser
  events. It stores each prompt in memory, consumes it once on user action, and
  handles cancellation, errors, installed windows and teardown. Previous snackbar
  dismissal storage no longer prevents a deliberate installation attempt.
- The standalone install button and dialog serve sign-in and account-menu entry
  points. `PwaConnectionStatusComponent` supplies the shared offline message.
- `ngsw-config.json` excludes `/api` and `/api/**` from navigation fallback, keeping
  API callbacks and downloads on the network. Existing API caching remains
  disabled. Existing authentication, logout and callback sanitisation are reused.
- Production Nginx already serves manifests with the correct MIME type and
  revalidates service-worker control files. Missing control files return 404,
  while Angular routes receive the app shell.

From the web repository, using its supported Node version:

```sh
npm ci
git submodule update --init --recursive
npm run verify:deployment-config
npm run verify:pwa
npm run test:ci -- --include='src/app/common/pwa/**/*.spec.ts' --include='src/app/common/pwa-connection/**/*.spec.ts' --include='src/app/common/header/header.component.spec.ts' --include='src/app/sessions/service-worker-updater/*.spec.ts' --include='src/app/sessions/states/sign-in/*.spec.ts'
npm run typecheck
npm run build -- --configuration production
npm run verify:pwa:build
```

The Node CI workflow verifies the production output, icon dimensions, cached-file
hashes and generated navigation rules. `dist/browser` is the deployable output.
Do not edit files after generating `ngsw.json`: its hashes must match the files
served. Use the existing `deploy.Dockerfile` and deployment release process.
The companion `doubtfire-deploy/DESKTOP-PWA.md` describes the public
HTTPS asset verifier, rollout and rollback checks.

The [validation record](desktop-pwa-validation.md) identifies completed local
checks and the browser/OS combinations still requiring acceptance.

## Required staging acceptance

Automated source/build checks and simulated install events do not prove OS
installation, SSO, notification delivery or every browser implementation. Record
the release SHA, browser/OS version and result for each intended platform:

1. Use a fresh normal profile on the staging HTTPS origin; verify the public PWA
   assets, then install through the OnTrack dialog or browser menu. Confirm app
   name/icon and a standalone launch from the OS launcher.
2. Repeat with an existing mobile installation to check identity preservation.
   Dismiss an install prompt, reopen help, and use the browser menu if it does not
   reissue an event. In an installed window, check the installed/help state.
3. Sign in with the institutional database/SSO flow. Open a protected deep link
   while signed out, then verify sign-in returns to it. Verify logout and another
   account do not expose the first account's data. SSO popups/redirects may be
   handled differently by installed browsers and require this real test.
4. Open Home, Unit Hub and Notifications; resize and test keyboard access,
   Escape/focus return from help, dark theme, uploads and downloads. Test available
   OS shortcuts. Check mobile layout for regressions.
5. After a successful online load, wait for the worker to finish caching its
   prefetch assets (`/ngsw/state` should report `NORMAL`). A registered worker
   alone does not mean the cache is ready. Then go offline. Verify the
   status message and failure of network actions without a success/queued claim.
   Reconnect and confirm the message clears without interrupting current work.
6. With notification permission and server push configured, send a test event to
   a synthetic account. Check delivery and that clicking it opens the protected
   destination. Repeat with notifications denied; installation must still work.
7. Deploy a second build, wait for/check an update, and accept Reload after saving.
   Confirm the new version and no duplicate app. Test the documented rollback
   while preserving the origin, app identity and matching service-worker hashes.

## Browser references

- [Chrome install behaviour](https://web.dev/learn/pwa/installation/)
- [Stable manifest identity](https://developer.chrome.com/docs/capabilities/pwa-manifest-id)
- [Safari web apps on Mac](https://support.apple.com/en-us/104996)
- [Firefox web apps on Windows](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows)
- [Edge PWA documentation](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/)
