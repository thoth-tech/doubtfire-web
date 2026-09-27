# Course Flow validation — 22 September 2026

Validated with the completed web planner and companion [API PR #176](https://github.com/ontrack-features-t2-2026/doubtfire-api/pull/176).

- Web implementation: `c44f8ecc08920b16b4f43c7a06f01d64183edb7f`, including current `11.0.x` at `283b493367681d1abab23e5fe7c633ba3a57e5c2`.
- API implementation: `129cb8f40a6c8d60b3e3cef2805fabb0285ef656`, based on `449945f33230140ce6c8da7eb3a15784844548f6`.
- Deploy `11.0.x` inspected at `2e513e190483d43112b09573a79c5bcf64bd220b`; unchanged. Validation ran in a separate local runtime, not a production deployment.
- Runtime: Node 22.23.2, Ruby 3.4.10, MariaDB 12.3, local Google Chrome through Playwright. Test and browser databases were separate and contained only generated seed data plus the explicitly fictional sample catalog.

| Check                                  | Result                                                     |
| -------------------------------------- | ---------------------------------------------------------- |
| Full web `npm run test:ci`             | 164 files, 1,288 tests passed                              |
| Full web `npm run lint`                | Passed, zero warnings                                      |
| Web `npm run build`                    | Passed, including lazy Course Flow bundle                  |
| API Course Flow model/API tests        | 24 tests, 206 assertions passed                            |
| Existing API authentication regression | 24 tests, 162 assertions passed using CI LTI configuration |
| Changed API Ruby lint                  | 8 files, no offenses                                       |
| API eager loading                      | `zeitwerk:check` passed                                    |
| Real HTTP integration                  | 10 checks passed                                           |
| Real Chrome browser integration        | 9 checks passed; no uncaught page errors                   |
| Whitespace                             | Both repositories passed `git diff --check`                |

The live browser test covers actual CDK pointer dragging, keyboard placement,
move/swap/remove, saving and full reload with empty periods preserved, cancellation
of dirty navigation, two-session save conflict and save-copy recovery, another
student's denied deep link, deletion, and a 390px viewport without document
overflow. The service tests run through the real authentication/error interceptors
and cover preserved 404/409 errors during normal requests and token-refresh retries.

Read the [browser result](evidence/result.json), [HTTP result](evidence/http-result.json),
and [reproduction instructions](README.md). Screenshots show fictional test plans:

- [Desktop](evidence/desktop.png)
- [390px layout](evidence/mobile.png)

The checks validate supported configured planning rules. They do not supply or
verify an official institutional curriculum, certify degree eligibility, or
claim a manual screen-reader/native Safari review. Neither repository was merged
or deployed as part of this work. Apply the companion API migration and import
approved catalog data before releasing the frontend.
