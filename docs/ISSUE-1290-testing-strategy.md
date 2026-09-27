# Vitest coverage and next integration checks (#1290)

This records the September 2026 test audit for
[doubtfire-web #1290](https://github.com/doubtfire-lms/doubtfire-web/issues/1290).
The application uses Angular's unit-test builder with Vitest, a jsdom environment,
and the setup file in `src/vitest-setup.ts`. The normal pull request suite does not
require a running API, browser installation, production account, or secrets.

## Running the checks

Use the Node version in `.nvmrc` (Node 22.22.3 or later in the supported Node 22
line), then run:

```sh
npm ci
npm run test:ci
npm run build
```

For a focused iteration, keep Angular's compilation step and select the spec:

```sh
npm run test:ci -- --include='src/app/common/file-downloader/file-downloader.service.spec.ts'
```

Run the whole suite before opening a PR. A focused run cannot detect interactions
with module registration, template compilation, or the rest of the application's
shared fixtures. Existing GitHub `Test CI` and `Node.js CI` workflows run the full
unit suite and application build on pull requests.

## Recorded validation

On the FL-22 / #1290 branch based on `11.0.x` commit `a35f2826d`, a clean
`npm ci`, `npm run build`, and the full `npm run test:ci` passed with Node 22.23.2.
The suite contains 146 files and 1107 passing tests. Targeted ESLint also passed.
The runner reports an existing nested `vi.mock` warning in the PDF viewer spec;
it is not a test failure. These results cover this branch, not future merges or
the longer-term browser/API jobs below.

## Gaps addressed

The audit found 143 existing spec files under `src/app`. The new tests focus on
observable behaviour in shared code that previously had no dedicated tests:

| Area                       | Regression checks                                                                                                                                                       | Defect caught                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File downloader            | Complete and multipart responses, requested byte bounds, missing/malformed ranges, gaps/duplicates, changing totals, interrupted transfers, and a server ignoring Range | Invalid ranges could leave the caller waiting or publish corrupt data; continuation end indexes were one too large; a full response was appended to already received bytes |
| Authentication interceptor | API and LTI credentials, anonymous requests, external/static requests, preservation of caller headers and immutable requests                                            | These cases now protect the shared request boundary                                                                                                                        |
| Authentication return URL  | Blocked browser storage, malformed persisted entries, future timestamps, exact expiry boundary, and one-use consumption                                                 | Extends existing unsafe URL, SSO, logout, and expiry checks                                                                                                                |

The downloader tests use `HttpTestingController` to assert the real `HttpClient`
request and response contract, without reaching an actual server. They verify the
assembled Blob contents rather than only checking that a callback ran. Every
case verifies no unmatched requests remain. The auth tests use harmless fixture
tokens and exercise the interceptor/service's public methods.

## Remaining coverage to prioritise

This is a risk-based audit, not a claim of complete statement or branch coverage.
Add tests with each change rather than treating creation-only specs as evidence
that every interaction works.

1. **Authentication refresh concurrency:** several simultaneous expired requests,
   failed refresh releasing every waiting subscriber, retry headers, and logout
   while a refresh is in flight. `HttpErrorInterceptor` currently has error-body
   extraction coverage but needs these stateful scenarios.
2. **Submission state transitions:** combine the upload modal, processing/retry API
   response, and selected task route to show that failed uploads retain the user's
   context and a successful upload returns to the intended dashboard.
3. **Staff workflows:** task-sheet navigation, tutorial changes, bulk portfolio
   operations, and permission refusals. Prefer DOM events and rendered state over
   direct calls to private component methods.
4. **Real browser behaviours:** focus restoration, drag/drop, recorded audio,
   actual CSS breakpoints, Blob downloads, and service workers. jsdom does not
   establish visual layout, accessibility, or browser permission behaviour.
5. **API compatibility:** serialization of deadlines, extensions and upload errors
   across the web/API boundary. A frontend mock cannot prove the server emits the
   expected data or enforces permissions.

## Longer-term API test approach

Keep deterministic frontend contract tests in the normal Vitest suite using
[`provideHttpClientTesting` and `HttpTestingController`](https://angular.dev/guide/http/testing).
Assert request methods, authorization conditions, query/body formats, and error
responses; do not simply return whatever object the component expects. Keep
fixture payloads near the consuming feature and link the corresponding API
endpoint/regression test in its PR.

Add a separate integration CI job for contracts that require the real API. Boot
pinned web/API/deploy revisions against an isolated disposable database, run
migrations and a small deterministic seed, wait for readiness, then authenticate
through the same endpoints used by the client. Use two fixture students and a
staff member in distinct units to test both allowed requests and cross-user
refusals. Run API model/request tests in the API repository as well; frontend
integration checks supplement them. Tear down the database after each job and
avoid production credentials or public notification delivery.

Start with three contracts: loading a student's enrolled units; reading the same
task's actual effective deadline; submitting a small fixture file and polling its
processing status. Add an explicit assertion for each relevant 4xx error. This
job should have its own failure report so an API startup failure is not presented
as a frontend assertion failure.

## Longer-term headless browser approach

Use two separate layers with a documented purpose:

- **Browser component tests:** Angular supports
  [Vitest browser mode](https://angular.dev/guide/testing) for interactions requiring
  a real DOM/browser. Pilot focus and download behaviours before moving large
  numbers of otherwise fast jsdom tests.
- **Student journey tests:** a Playwright suite against the built application.
  Its [`webServer` configuration](https://playwright.dev/docs/test-webserver) can
  manage an isolated local server. For fast PR checks,
  [route mocks](https://playwright.dev/docs/network) should cover login, loading a
  unit, selecting a task, submitting a file, and the resulting dashboard state.
  Add failures for rejected credentials, unavailable units, and failed uploads.
  Start with Chromium, then add Firefox/WebKit for browser-specific controls.

The real API job should reuse the same journeys without route mocks, against the
seeded stack. Keep mocked and real API runs explicitly named; passing a mocked
journey does not prove server compatibility. Use role/name locators and web-first
assertions rather than fixed sleeps. Store a trace/screenshot only on failure,
redact test authorization headers, and keep fixture users' data synthetic. A
service-worker-specific test must run separately from tests that block service
workers for reliable network interception.

These longer-term jobs are an investigated implementation plan, not new CI
requirements in this PR. They need their own pinned runtime fixtures and review
before becoming required checks.
