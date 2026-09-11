# PPI-F02 Unit Peer Progress Summary Handover

## Delivered scope

PPI-F02 adds a reusable mock-backed unit-level Peer Progress Indicator summary
to the student Progress Dashboard.

The component displays:

- the student's own unit progress;
- a separately labelled anonymous cohort aggregate;
- genuine zero progress;
- small-cohort suppression;
- unavailable data;
- stale data;
- disabled, loading and error states.

The presentational component receives the existing typed
`PeerProgressUnitSummaryViewModel` through an input.

It does not make an HTTP request, create another PPI service, or calculate its
own percentage formula.

## Existing PPI work reused

This implementation reuses:

- `PeerProgressUnitSummary`;
- `PeerProgressUnitSummaryViewModel`;
- `resolvePeerProgressUnitSummaryState`;
- `PeerProgressIndicatorService.getDemoUnitSummary` (only while the local demo-mode switch is on);
- `calculateCompletionPercentage`.

The existing task-sheet PPI widget and Progress Burndown implementation were
not modified.

## Privacy boundary

The component does not display peer names, student IDs, project IDs, individual
task statuses, marks, feedback, rankings, or raw cohort counts.

Suppressed, unavailable and stale states remove the anonymous cohort percentage
before it reaches the component display.

Disabled, loading and error states do not retain percentages that could be
mistaken for current information.

A real 0% remains visibly different from unavailable or suppressed data.

The unit summary is not displayed when staff are viewing another student's
project.

## Remaining live unit-level API requirement

PPI-F02 does not deliver a live backend unit-summary endpoint.

A future backend endpoint and frontend adapter should:

- authenticate the caller;
- derive student identity from the authenticated session;
- **derive the target grade server-side from the student's own project, and
  never accept one from the browser.** `PeerProgressIndicatorService`'s mock
  takes a caller-supplied `targetGrade` and its own comment warns that this
  must not become the design of a live endpoint. A unit endpoint that trusts a
  browser-supplied grade lets a student read another cohort's aggregate;
- authorise access to the requested unit/project;
- enforce minimum-cohort suppression server-side;
- **add a `student_percentage` field.** The task-level contract shipped in
  doubtfire-api#16 does not carry one, so the card computes it in the browser
  today. That is a stopgap, not the target design;
- **quantise the student percentage into the same buckets as the cohort
  percentage.** doubtfire-api#16 quantises the cohort figure to 10-point
  buckets. An exact student number beside a bucketed cohort number invites a
  comparison neither supports;
- avoid peer identities and raw cohort counts;
- avoid marks, feedback and individual task-state information;
- expose feature-enabled, suppression, stale/unavailable and timestamp state;
- use appropriate audit logging without recording sensitive student content.

The future frontend adapter can replace the mock call inside
`ProgressDashboardComponent.loadPeerProgressUnitSummary()` without redesigning
the presentational component.

### Task-level adapter nullability

doubtfire-api#16 returns `null` for `last_updated_at` and `target_grade` in
several documented states. The task-level live adapter now maps those values to
`PeerProgressIndicator.lastUpdatedAt: string | null` and
`PeerProgressIndicator.targetGrade: number | null`.

### The mock must not reach a production build

The unit-level summary in this document remains mock-backed and is gated on
`environment.production`, so a built application shows the unavailable state
rather than a fabricated percentage. The task-sheet `f-ppi-widget` now uses the
authorised project/task API route and does not render a fixture in production.

## Validation

Targeted component tests cover:

- normal progress;
- genuine zero;
- small-cohort suppression;
- unavailable data;
- disabled data;
- stale data;
- changed component inputs.

Final validation should include:

- TypeScript typecheck;
- targeted PPI-F02 tests;
- lint;
- full frontend tests;
- build;
- `git diff --check`;
- normal desktop screenshot;
- normal narrow-screen screenshot;
- suppressed or unavailable screenshot.

## Attribution and takeover

PPI-F02 builds on the shared unit-summary foundation merged through PR #31.

Any earlier work from the original assignee should remain credited and preserved.
The takeover message and branch/PR search should be retained as project evidence.
