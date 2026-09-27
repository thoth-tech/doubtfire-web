# Desktop PWA validation — 21 September 2026

Implementation base: web `283b49336` on `11.0.x`; companion deploy base `2e513e1`.
Test environment: macOS, Node 22.23.2, Angular 22.0.3, Chrome 153.0.8010.48.

## Automated checks

- 60 focused Angular tests passed across installation service/dialog/button,
  offline status, header, sign-in and update service (seven spec files).
- Production Angular build and application type checking passed. The build emits
  existing large component-style, CommonJS and dependency/minification warnings;
  this feature does not resolve those unrelated warnings.
- Targeted ESLint, Prettier and `git diff --check` passed.
- `npm run verify:deployment-config`, `npm run verify:pwa` and
  `npm run verify:pwa:build` passed against the final production output.
- Companion deploy verifier: 15 HTTP regression tests passed; the CLI passed
  against these production assets served on loopback.

## Real Chromium smoke test with synthetic API responses

A disposable persistent Chrome profile loaded the actual production output from
an isolated loopback HTTP server. Only public branding/auth-method responses were
stubbed; authentication returned a signed-out result. No real account or live
institutional server was used. This automated run did not install an OS app;
the separate interactive checks below did.

Passed:

1. Sign-in install entry, browser help dialog, Escape and return of focus.
2. Chrome's manifest parser and installability checks returned no errors; the
   real Angular service worker controlled the page.
3. Public-asset verifier accepted the served production output.
4. Offline status appeared; after all prefetch assets finished caching, a reload
   came from the service worker and rendered the offline app shell.
5. Reconnect cleared the warning without forcing navigation.
6. `/api/d2l/callback` navigation returned network JSON instead of app HTML.
7. Installation help remained within a 390px viewport, retaining mobile guidance.
8. No uncaught page errors occurred.

The cold offline shell displays the existing unavailable state because sign-in
and public settings need the API; this is expected, not offline authentication.
The test waits for all prefetch cache entries and `Driver state: NORMAL`; a
controller alone is insufficient. Chrome's network simulation uses both request
blocking and `Network.overrideNetworkState` so `navigator.onLine` remains false
across document reloads. The earlier controller-only and incomplete emulation
attempts were corrected in the test harness, without changing production code.

[Machine-readable browser result](evidence/desktop-pwa-20260921/browser-results.json)

![Desktop installation help](evidence/desktop-pwa-20260921/desktop-install.png)

![Offline connection status](evidence/desktop-pwa-20260921/desktop-offline.png)

![390px viewport installation help](evidence/desktop-pwa-20260921/mobile-install.png)

## Interactive macOS installation

Using the actual production build at an isolated loopback origin with signed-out
API fixtures, native UI checks passed on macOS 27.0 (26A428):

| Browser              | Observed result                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome 153.0.8010.48 | Browser installation created an OS application with the manifest name and `/index.html` start URL. The app launched in a standalone window, showed **OnTrack app help**, and relaunched after closing. Uninstall removed the application. A second pass through the foreground in-page Install button opened Chrome's native prompt, allowed cancellation and retry, and reinstalled with the same application ID. The temporary app was then uninstalled again. |
| Safari 27.0          | The help dialog offered manual instructions without a Chromium-only Install button. **File → Add to Dock** selected `/index.html`; the temporary app, named **OnTrack Desktop QA**, opened in its own window, showed the installed help state, and relaunched successfully. The app was quit and moved to Bin through Finder; removal was verified.                                                                                                              |

These checks used normal local browser profiles and native installation
confirmations. Temporary applications were removed afterwards; unrelated browser
data was not cleared. They establish local installation behavior, not a result
for an institutional HTTPS origin or authenticated Safari session.

[Native installation record](evidence/desktop-pwa-20260921/native-install-results.json)

## Database authentication against an isolated API

A separate Rails/MariaDB stack with synthetic demo fixtures served real API
responses to the production web build through a loopback proxy. A disposable
Chrome profile passed nine authentication checks: protected-route redirection,
incorrect-password rejection, successful sign-in returning to `/notifications`,
loading seeded notification records, authenticated reload through the refresh
cookie, logout, rejection of the revoked access token, inability to refresh the
logged-out session, and denial of a protected route after logout. There were no
uncaught page errors. Credentials and tokens are excluded from the evidence.

The [authentication evidence and reproduction guide](evidence/desktop-pwa-20260921/authenticated-checks/README.md)
record the API source/runtime and fixture scope. This exercised database
authentication in a normal browser, not institutional SSO or an authenticated
installed Safari app. The application's existing external editor/font assets
were allowed to load; these checks do not establish offline authentication.

## Real worker update and recovery

The [portable regression harness](evidence/desktop-pwa-20260921/update-checks/README.md)
passed eight checks in a disposable Chrome profile using copies of the production
build, synthetic release markers and signed-out API fixtures. The actual worker
downloaded release B and the application's Reload notice appeared. The existing
document and a synthetic unsaved textarea value survived for ten seconds until
the user action; Reload then loaded B successfully.

Restoring the identical original A manifest left both existing and newly opened
clients on cached B. Publishing the same A asset bytes with a fresh Angular
manifest timestamp produced a distinct recovery version. The real Reload action
returned to A, preserving app identity and scope, with worker state `NORMAL`.
The recovered shell also reloaded offline and recovered on reconnect. There were
no uncaught page errors. This is a coherent synthetic-release regression, not a
Docker image publication or production rollback rehearsal.

[Machine-readable update/recovery results](evidence/desktop-pwa-20260921/update-checks/results.json)

## Not yet exercised

Windows and Linux OS installation; Edge and Firefox installation; institutional
SSO; authenticated Safari sessions; course submission/download workflows; live
Web Push; and real Android/iOS installation regression. The currently documented
hosting address was not reachable during this session, so no public HTTPS
deployment or production acceptance is claimed. Complete the applicable
[staging acceptance checklist](desktop-pwa.md#required-staging-acceptance) on the
intended origin before production rollout. Local results do not certify browser
and platform combinations that were not exercised.
