# First-Time OnTrack Tutorial implementation

TUT-W01–W04, TUT-S01, TUT-T01, TUT-Q01 and TUT-MVP01. This is the reviewable
implementation handover, not a claim of release or human approval. The tutorial
is disabled unless authenticated settings explicitly return `tutorialEnabled: true`.

The [student and contributor guides](https://github.com/ontrack-features-t2-2026/github-guide/tree/main/docs/student-onboarding)
remain the central written guidance. The account menu now contains **Tutorial and Help**
for authenticated students after profile and data loading, when the institution
has enabled the feature. The written guide is also linked from every tutorial panel.

## Architecture and maintenance

- [Shell](../../src/app/student-onboarding/student-onboarding.component.ts): welcome,
  four guided steps, confirmation and completion. Existing CDK focus trapping is
  used for modal panels; guided steps remain non-modal. Escape follows the
  [prototype keyboard contract](https://github.com/ontrack-features-t2-2026/github-guide/blob/main/docs/design/student-onboarding-prototype-review/keyboard-and-focus.md).
- [Registry](../../src/app/student-onboarding/student-onboarding.steps.ts): version,
  stable ID, route context, target, exact DOC-11 title/body, locate-action label and
  missing-target fallback. Route is explanatory metadata, never an automatic
  navigation instruction. Students choose their own unit and navigate themselves.
- [Service](../../src/app/student-onboarding/student-onboarding.service.ts): readiness,
  own-user history check, browser progress, transitions and replay. It never writes
  the existing profile setup flag, assessment data or Calendar settings.
- [Target resolver](../../src/app/student-onboarding/student-onboarding-target.ts):
  visible explicit `data-onboarding-target` attributes; rejects selector input.
  DOM changes, resize and scroll refresh highlights without activating controls.

| Step | Stable target | Real location / fallback |
| --- | --- | --- |
| Choose Your Unit | `unit-selector` | Header unit dropdown (both selected and unselected states). No units: explain enrolment support. |
| Find Your Tasks | `task-dashboard` | Current project navigation menu trigger. No selected project: explain Select Unit then Dashboard. |
| Check Your Target Grade | `target-grade` | Dashboard Select Target Grade control; unavailable/hidden: explain its location and continue. |
| Use the Calendar | `calendar` | Existing desktop Calendar button or visible account-menu Calendar entry. Narrow screens: explain account menu, then Calendar. |

`account-menu` is the permanent focus-return fallback, not a fifth tutorial step.
The tutorial does not click a menu, select a unit, navigate a route, change a grade,
create a subscription or submit a task. **Find…** only scrolls the current target
into view following an explicit user click. No extra tour dependency was added.

To update a step, edit the approved [DOC-11 copy source](https://github.com/ontrack-features-t2-2026/github-guide/blob/main/onboarding-tutorial-step-copy.md)
and registry together. Keep IDs stable when reordering. A material add/remove,
reorder, route/target move or meaning change increments `ONBOARDING_VERSION`.
Spelling corrections do not. Existing completion/dismissal survives version changes;
incomplete older versions restart from the beginning. Update target, fallback and
version tests before retiring an ID. Never reuse an old ID for another purpose.

## Eligibility, persistence and failures

The [DOC-10 / TUT-D03 contract](https://github.com/ontrack-features-t2-2026/github-guide/blob/main/onboarding-tutorial-trigger-and-state-rules.md)
contains the decision table. Automatic eligibility requires observing incomplete
profile setup and a successful current-user history request returning **zero**
projects, including withdrawn and inactive projects. The request uses the
authenticated `GET /projects/history` response `{hasProjects:boolean}`. Only the
exact response `{hasProjects:false}` establishes empty history. Authentication
supplies the owner; no user ID or query arguments are sent and no project details
are returned or retained. A missing/older endpoint is replay-only.

This intentionally excludes some newly enrolled students who already have a
project. Unknown/error/non-empty history is replay-only. An empty active-project
cache does not establish newness. Profile and globals must then finish loading;
welcome, profile editing, sign-in/out and SCORM routes cannot be interrupted.

Browser progress is exactly `{version,state,step}` under
`ontrack:student-onboarding:<authenticated user id>`. States are `new`,
`in-progress`, `skipped`, `dismissed`, `completed`; step IDs are from the registry.
The key scopes normal use to the current account but is not an authorization
boundary against another person using the same browser profile.

Start/Back/Next save `in-progress`; a new session resumes its current-version step.
Skip/Close save `skipped`, suppressing repeats this session. The skip confirmation
separately explains permanent dismissal. Completed/dismissed decisions are not
re-prompted, including after a version bump. Replay always begins at the welcome
panel and leaves the entire saved automatic decision unchanged. Sign-out or flag
off closes the shell and clears only memory. Storage corruption, future schemas,
read/write failures and a failed/timed-out history request fail open to normal use.

## Validation and handover

See [test traceability and QA](validation.md), the [portable browser fixture](browser-qa/README.md)
the [targeted full-application acceptance and recording](full-app-qa/README.md),
and the [threat model](threat-model.md).
The original welcome/profile component and its tests remain in place. The API
change PR-TUT-17 supplies a default-false environment switch; no tutorial progress
endpoint, database migration or deployment change is required by this frontend.
Automatic eligibility does require the new bounded own-user `/projects/history`
read endpoint, which includes withdrawn history; the ordinary projects list cannot
prove its absence.

Status: implemented for PR review, with release/pilot decisions pending. Existing
TUT-UX01 prototype documents explicitly record pending human approvals. Do not
report those as completed, and do not enable the tutorial for a cohort solely
because the automated checks pass. TUT-U01-RUN needs real representative reviewers;
TUT-U01-FIXES depends on actual findings. No participant feedback, recordings,
second-contributor review or approval has been invented here. TUT-D04's final
walkthrough and manual acceptance evidence remain review handover items.
