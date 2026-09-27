# Tutorial validation and evidence

TUT-T01 / TUT-Q01 / TUT-MVP01. Feature branch base: web `11.0.x`
`d16f6201caff78082e5e83c540320dbee5871404`, then rebased onto `a35f2826d`. The implementation is proposed in [web PR #263](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/263);
[guide PR #12](https://github.com/ontrack-features-t2-2026/github-guide/pull/12) records the coordinated rules and handover. Do not interpret a workbook checklist as evidence of execution.

## Automated traceability

| Requirement / ticket | Evidence |
| --- | --- |
| TUT-W01 shell and controls | Component tests render welcome, step, confirmation, completion, Back/Next/Skip/Dismiss/Close/Finish and accessible names. |
| TUT-W02 new/returning/staff eligibility | Service tests require incomplete profile plus explicit false own-history boolean; suppress true/unknown/error history (API includes withdrawn/inactive enrolments); wait readiness and safe route. |
| TUT-W02 persistence / privacy | Service tests exercise resume, skip, dismiss, completion, replay preservation, account replacement, malformed/future records, blocked reads/writes and stale history. |
| TUT-W03 real targets / fallback | Component/target tests resolve all four attribute contracts; ignore hidden, inert, detached and zero-size targets; show written fallback. Header regression tests compile the shared controls. |
| TUT-W03 no automatic actions | Service state snapshots and route spy; component locate action scrolls without clicking; no write API exists in tutorial source. |
| TUT-W04 replay | Service tests start completed/dismissed users from the beginning and preserve storage; header menu supplies one entry. |
| TUT-S01 off switch | Constants regression accepts explicit true only; missing setting and sign-out reset false; service rejects disabled/unauthenticated/staff launch. |
| Existing profile setup | Run unchanged WelcomeComponent and EditProfileFormComponent specifications alongside tutorial tests. |
| TUT-Q01 accessibility | Component tests verify heading focus, labels, polite step announcements, modal/non-modal distinction, Escape dispatch and control order. Real assistive-technology testing remains separate below. |

## Reproducible commands

Use the Node version in `.nvmrc` or a compatible Node 22 runtime and dependencies
from `npm ci --legacy-peer-deps`. Run:

```sh
npm run typecheck
npm run lint
npm run build -- --configuration production
npm run test:ci -- --include='src/app/student-onboarding/*.spec.ts' --include='src/app/config/constants/doubtfire-constants.spec.ts' --include='src/app/welcome/welcome.component.spec.ts' --include='src/app/common/edit-profile-form/edit-profile-form.component.spec.ts' --include='src/app/common/header/header.component.spec.ts'
```

On a busy host, Vitest may need one worker. An external runner config can set
`test: {maxWorkers: 1, fileParallelism: false, pool: 'threads'}` and be passed with
`--runner-config=<path>`. This changes scheduling, not assertions. Browser progress remains local. The API switch and authenticated own-history
endpoint have separate API tests in the companion change.

Actual command results and limitations are recorded in [verification.txt](verification.txt).

## Browser fixture and manual QA matrix

The [portable fixture](browser-qa/README.md) mounts the production tutorial with
its real global theme and synthetic surrounding controls.

Record browser/version, viewport/zoom, input method, synthetic scenario, result,
evidence and owner for each run. Automated jsdom checks do not constitute browser,
screen-reader or pilot sign-off.

| Scenario | Required checks | Status |
| --- | --- | --- |
| New student, zero history, after setup | Welcome; all four steps; Back/Next; completion; reload | State/control tests and synthetic browser matrix passed; full-app manual acceptance pending |
| Existing/in-progress/skipped/completed/dismissed | Eligibility; resume; skip later; permanent suppression; manual replay | Unit tests and synthetic browser lifecycle checks passed; real session acceptance pending |
| Student/staff/anonymous, disabled flag | Correct visibility; no interrupted setup/auth | Service tests plus synthetic staff/disabled cases passed; deployed setting verification pending |
| No unit/project, missing/hidden/delayed target | Explanation; Next/Close; normal page remains usable | Target tests passed; synthetic missing-unit/control screenshots captured |
| History timeout/failure, storage failure | Normal use, no retries/loop; replay/warning | Service tests and synthetic browser storage failure/replay checks passed; institution browser-policy QA pending |
| Keyboard only | Heading focus; visible focus; tab order; modal exit; non-modal step navigation; return focus | Component tests plus browser Tab, Escape and narrow-panel keyboard scrolling checked; full-app keyboard acceptance pending |
| Screen reader / accessibility inspector | Named dialogs/controls; step title/count; decorative highlight ignored | Browser accessibility-tree snapshots captured; human assistive-technology run pending |
| Desktop / 390px / 320px / 200% zoom | All controls reachable; no lost target; readable panel; scrolling | Synthetic viewports and 200% CSS zoom checked; native 200% welcome is verified below; remaining panels need native zoom acceptance |
| Reduced motion | No essential animation; explicit locate scroll is instant | Synthetic browser context uses reduced-motion preference and asserts no panel animation |
| Chrome / Edge / Firefox / Safari where available | Same flows and failure states | Individual engine/version results in the linked evidence; WebKit is not a native Safari run |
| Route changes and browser Back | Current target refreshes or falls back; no tutorial navigation side effects | Service tests and synthetic real Angular Router/browser Back checks passed; full-app history acceptance pending |

The [browser evidence](browser-qa/evidence/README.md) records the exact engine
versions and assertions against production code `0ff843477`. It mounts production
tutorial code, real global theme and real Angular Router events with synthetic
accounts, history responses and surrounding controls. It does not establish full
application routing, API authorization, actual enrolled projects, human screen
reader behavior or native browser zoom.

## Combined compatibility check

A temporary local tree combined tutorial `0ff843477` and migration `66e3e2056`.
Its full suite passed **1,158 tests in 151 files** and its default development build passed.
The tree and exact heads are recorded in [combined-validation.json](browser-qa/evidence/combined-validation.json).
This snapshot was neither pushed nor merged on GitHub. The branch combination
checks and test evidence support review; they do not substitute for reviewer approval.

## Pilot and closure boundaries

Use the existing [pilot script and de-identified templates](https://github.com/ontrack-features-t2-2026/github-guide/tree/main/docs/evidence/student-onboarding-pilot).
TUT-U01-RUN requires at least three representative people, including a novice.
TUT-U01-FIXES requires actual triaged findings before a fix can be attributed to the
pilot. No names, assessments or invented observations belong in evidence.

Human prototype/security approvals, second-contributor review, independent review of the versioned fallback
recording, full-application/native-browser-zoom/assistive-technology QA and pilot sessions remain pending.
This handover completes the repository implementation and reproducible test assets;
it does not claim those external review activities happened or that PRs merged.

## Remaining workbook ticket mapping

| Ticket | Repository deliverable / remaining boundary |
| --- | --- |
| TUT-W01 | Reusable standalone shell, typed registry, explicit targets, focus and fallback behavior implemented. |
| TUT-W02 | Auth/profile/history gate, browser state, resume, skip, completion, dismissal, version handling and failure behavior implemented. |
| TUT-W03 | Four existing controls annotated; exact DOC-11 copy and safe fallbacks implemented; no automatic actions. |
| TUT-W04 | One role/flag-gated account-menu replay entry and written guide link implemented. |
| TUT-T01 | 104 unique focused tests, unchanged welcome/profile regressions, full lint/typecheck/build, combined 1,158-test compatibility run and command evidence supplied. |
| TUT-S01 | Data flow, fields, trust boundaries, dependency decision and security tests supplied; human approval pending. |
| TUT-Q01 | Automated semantics/state/route checks, reproducible browser fixture, engine evidence and manual matrix supplied; synthetic evidence is supplemental to full-app and assistive-technology QA. |
| TUT-D04 | Implementation locations, maintenance/version rules, troubleshooting and handover supplied; central guides updated in github-guide; second human review/video pending. |
| TUT-MVP01 | Evidence index and honest handover supplied; PR review, pilot and full release validation pending, no merge claimed. |
| PR-TUT-17 | Separate API default-false runtime flag and bounded own-history endpoint change; this frontend consumes the authenticated response and resets on sign-out. |
| TUT-U01-RUN | Existing pilot script/templates linked; real representative participants cannot be fabricated by repository work. |
| TUT-U01-FIXES | Requires actual pilot findings; no invented critical/high issues, participant findings or approvals. |

## Full application follow-up

The [full-app acceptance package](full-app-qa/evidence/README.md) adds actual
synthetic sign-in/profile completion followed by the automatic welcome, a native
Chrome 200% welcome capture, and the enrolled-student four-step/completion/replay
flow against real API data in Chrome, Edge and Firefox. A 29-second annotated
fallback recording is supplied, pending a second human review.

This uses the pinned local combined **default/development** artifact, whose exact
tree can be reconstructed from published parents as documented. It does not claim
a deployed production acceptance run. The earlier combined build label was corrected
from production to default/development after inspecting the original command log.
The separate original tutorial production build result remains unchanged.

The [follow-up limits and exact next steps](full-app-qa/evidence/README.md#exact-limits-and-remaining-acceptance)
identify integrated state/failure/native keyboard/zoom checks still outstanding,
the native Mac-lock interruption, unsupported native Safari, and the human reviews
and representative-user pilot. Previously passed fixture and automated state tests
remain distinct evidence.
