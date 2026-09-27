# Course Flow integration checks

See the [recorded validation](validation.md) for results and screenshots.

These scripts use the real application and API. They require a **disposable,
local** environment with separate test/development databases, the companion
API migration, and its explicitly fictional `DEMO-CF / QA-2026` catalog.
They refuse remote hosts. No network responses are mocked.

Start from the repositories' local setup instructions and a seeded development
database. Import the API's `docs/courseflow/sample-catalog.json` using
`bundle exec rake 'courseflow:import[docs/courseflow/sample-catalog.json]'`.
The fixtures use the seed accounts `student_1`, `student_2`, and `aadmin` with
their local development password `password`. Complete first-time setup for the
two students. In the disposable development API container this can be prepared
with:

```sh
bundle exec rails runner 'abort unless Rails.env.development?; User.where(username: %w[student_1 student_2]).update_all(has_run_first_time_setup: true)'
```

Run the API on `127.0.0.1:4320` and Angular on `127.0.0.1:4321`, proxying `/api`
to the API. Alternative local URLs can be supplied through the variables below.
The scripts create named QA plans. Successful checks delete them; a failed
browser run can leave its named plan for inspection in this disposable database.

```sh
COURSEFLOW_API_URL=http://127.0.0.1:4320 \
  COURSEFLOW_HTTP_RESULT=/tmp/courseflow-http-result.json \
  node docs/course-flow/http-check.mjs

COURSEFLOW_WEB_URL=http://127.0.0.1:4321 \
  COURSEFLOW_BROWSER_OUTPUT=/tmp/courseflow-browser-check \
  node docs/course-flow/browser-check.mjs
```

The browser script needs Playwright and locally installed Google Chrome. It uses
the `playwright` module if available, or an absolute `PLAYWRIGHT_MODULE` path to
an installed Playwright `index.mjs`. This keeps browser tooling optional rather
than adding it to the production dependencies.

The HTTP check verifies student catalog access, private owner scoping (including
administrator isolation), create/save/reload/delete, explicit empty periods,
malformed placement rejection, atomicity, stale writes/deletes, and configured
planning issues. The browser check covers pointer drag, keyboard placement,
move/swap/remove, reload, canceled dirty navigation, two-session conflict and
save-copy recovery, another student's denied deep link, and a 390px viewport.
Screenshots and a token-free JSON result are written to the chosen output path.

These checks use sample rules, not an institutional curriculum. They are not a
manual screen-reader review, native Safari check, or official degree audit.
