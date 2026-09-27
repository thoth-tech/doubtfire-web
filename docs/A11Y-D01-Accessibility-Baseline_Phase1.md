# OnTrack Accessibility Baseline - Phase 1

**Ticket:** A11Y-D01 - Define the OnTrack accessibility baseline and critical user journeys
**Branch:** `docs/accessibility-baseline`
**Scope:** Documentation and copy specification only. No production code, API behaviour or data flow is changed by this document.
**Source snapshot:** `11.0.x` at `d16f6201caff78082e5e83c540320dbee5871404`. Journey mappings below describe that revision; re-check them when the implementation changes.

## 1. Purpose & Scope

The document exists so that every accessibility audit and implementation ticket for OnTrack works from the same test scope, the same severity language, the same evidence format, and a shared understanding of what "done" means for this phase of work. It is written in plain language throughout, so that anyone on the team - _regardless of technical background_ - can read, apply, and rely on it without needing to interpret jargon or infer intent.

### 1.1 What this document covers

- Site-wide support for people with disabilities and neurodivergent users, across both technical accessibility (_keyboard, screen reader, semantics, etc._) and cognitive/neurodivergent usability (_plain language, predictable layout, minimal unnecessary complexity_).
- Two critical, end-to-end user journeys - one **student**, one **staff** - mapped against OnTrack's real routes and components, to give future audits a concrete, reproducible starting point rather than an abstract checklist.
- Desktop web, mobile browsers, and the installed standalone PWA defined by [`src/manifest.webmanifest`](../src/manifest.webmanifest). A narrow desktop viewport alone does not establish mobile-app support; use the device and assistive-technology passes in Section 5.

### 1.2 What this document explicitly excludes

**Dark mode** is a separate objective and is not covered here. Where this baseline discusses colour and contrast, it is testing OnTrack's existing colour scheme as it stands today, not preparing for or requiring a dark mode implementation.

### 1.3 Relationship to other objectives and tickets

- This baseline applies across all objectives - any team running an accessibility audit or building a new feature **should use the terminology, severity scale, and finding template defined here**.
- However, this does **not** make this objective the implementation owner for every feature's accessibility. Individual features and their tickets retain ownership of their own behaviour and their own accessible implementation. This document sets shared expectations; it does not centralise responsibility for meeting them.
- Reuse the existing [A11Y-V01 validation notes](A11Y-V01-validation-notes.md), merged in [PR #239](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/239), as dated evidence for its recorded build and environments. Those notes document a prior audit and outstanding independent review; this document defines the reusable baseline. Neither document proves that later changes or untested mobile/PWA combinations pass.

### 1.4 Boundary on future usability

No one participating in future usability testing or feedback sessions related to this work will be required to disclose a disability or diagnosis in order to take part. Testing methods and recruitment should be designed with this in mind from the outset.

## 2. Target Standard

OnTrack's accessibility target for this phase of work is [**WCAG 2.2 Level AA**](https://www.w3.org/TR/WCAG22/).

This is a **target the team is working toward, not a certification claim**. Adopting this standard means it is the benchmark used to write test methods, judge findings, and prioritise fixes throughout this baseline and the audits that follow it. It does not mean OnTrack currently meets [WCAG 2.2 AA](https://www.w3.org/WAI/WCAG2A-Conformance), that any page has been certified as compliant, or that meeting this target removes the need for ongoing attention as the site changes. Progress toward this target should be understood as an improvement and guardrail program - measurable progress, without ever presenting the current state of the site as fully compliant.

## 3. Critical User Journeys

---

### 3.1 Student Journey

Enter Unit - View Task - Submit Work - Find Feedback

| Step                            | Route                                              | Component                                                                          | Role Required                                                                      | Notes                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enter unit / view task list** | `/projects/:projectId/dashboard`                   | `ProjectDashboardComponent`                                                        | Student (project owner)                                                            | Desktop uses a split-pane layout with a CDK drag divider. Below 640 CSS px, use the Overview and Tasks controls; verify keyboard, touch, and screen-reader access to each pane.                                                                                                                                |
| **View a task (incl. status)**  | `/projects/:projectId/dashboard/:taskAbbreviation` | `TaskDashboardComponent`, `TaskStatusCardComponent`, `TaskAssessmentCardComponent` | Student; staff views depend on unit-role checks, with Mod Notes further restricted | Select a task, then Task Details, Task Sheet, or Your Submission. Task Details contains status and, for graded/rated tasks, Assessment Information. Check tab navigation, active-state announcements, and the phone Details control.                                                                           |
| **Submit work**                 | N/A — modal opened from a submission action        | `UploadSubmissionModalComponent`                                                   | Student (project owner)                                                            | Group rating (when applicable), upload, then comment. At least 25 trimmed characters are required for Need Help and for feedback/reupload on portfolio-only tasks. Check file selection without dragging, validation, disabled-submit explanation, success/error announcements, and focus return.              |
| **Find feedback**               | Same selected-task route                           | `TaskCommentsViewerComponent` in `ProjectDashboardComponent`                       | Student (project owner)                                                            | Read feedback in the comments sidebar, using Open task comments when collapsed below 1000 CSS px. Below 640 CSS px, use the top-level Feedback control. This is separate from the Task Details tab. Verify the correct task's comments, status events, and attachments remain reachable after switching panes. |

### 3.2 Staff Journey

Find Submission - Review - Give Feedback - Change Status

| Step                                         | Route                                                       | Component                                                                         | Role Required                                                                                  | Notes                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Find a submission (Inbox)**                | `/units/:unitId/tasks/inbox` (+ `/:studentId/:taskDefAbbr`) | `UnitTaskInboxStateComponent` (routeMode: inbox)                                  | Tutor, Convenor, Admin, Auditor                                                                | Default landing page for a unit - shared component across all four modes below.                                                                                                                                                                             |
| **Find a submission (Explorer)**             | `/units/:unitId/tasks/definition` (+ variant)               | same (routeMode: definition)                                                      | Tutor, Convenor, Admin, Auditor                                                                | Filter by task definition.                                                                                                                                                                                                                                  |
| **Find a submission (Moderation)**           | `/units/:unitId/tasks/moderation` (+ variant)               | same (routeMode: moderation)                                                      | Tutor, Convenor, Admin, Auditor                                                                | Mentor moderation queue.                                                                                                                                                                                                                                    |
| **Find a submission (Overflow)**             | `/units/:unitId/tasks/overflow` (+ variant)                 | same (routeMode: overflow)                                                        | Tutor, Convenor, Admin, Auditor                                                                | Overdue queue.                                                                                                                                                                                                                                              |
| **Claim an overflow task (when applicable)** | Same selected-task route; footer action                     | `TaskClaimComponent` in `FooterComponent`                                         | Route whitelist above plus a unit staff role; claim state gates actions                        | Claim Task is shown for overflow or an already-claimed task. The message says the claim expires after 30 minutes of inactivity. Verify claimed/disabled states and success/error announcements.                                                             |
| **Review the submission**                    | Same selected-task route                                    | `InboxDashboardComponent`                                                         | Route whitelist above; staff/Mod Notes have additional component restrictions                  | Select the submission/document tab and inspect the PDF viewer. On phones, also test Open current document and returning to the selected task.                                                                                                               |
| **Give feedback**                            | Same selected-task route; comments panel                    | `TaskCommentsViewerComponent`, `TaskCommentComposerComponent` in `InboxComponent` | Authorised staff viewer for the selected task                                                  | Open task comments if collapsed; enter and send synthetic feedback. Verify editor naming, send/attachment controls, validation, and the saved comment from the student Feedback pane.                                                                       |
| **Change task status**                       | Same selected-task route; footer action                     | `FooterComponent` calling `Task.updateTaskStatus()`                               | Route whitelist above; loading, claim ownership, and discussion requirements also gate actions | Use an available status action such as Resubmit, Discuss, or Complete. Check disabled reasons, confirmation dialogs where applicable, success/error announcements, and the resulting student status. In Moderation, use View Status Buttons when necessary. |
| **Grade the submission (when applicable)**   | Modal opened during a status change                         | `GradeTaskModalComponent` via `Task.updateTaskStatus()`                           | Same action restrictions as the status change                                                  | For a graded or quality-rated task, a gradeable target status opens the grade/rating dialog. Check keyboard and screen-reader operation, submit/cancel, focus return, and persisted values after reload.                                                    |

The route guard controls entry, not permission for every mutation; use appropriate synthetic unit-role fixtures and record API denials as well as UI restrictions. Student project access is resolved through the project route, not a Student-only whitelist on the dashboard.

**Known phone coverage gap at this snapshot:** `InboxComponent` renders `f-footer` only in its desktop branch (600 CSS px and wider). The phone branch contains the document and comments views but no equivalent footer. Do not record claim, status-change, or grade completion on phones as passing without verifying an accessible alternative or a later fix. The journey is mapped here; successful execution on every device remains audit work.

## 4. Accessibility Test Areas

---

For each area: _what to check_, _how to check it_, and _what evidence to capture_. Where the journey mapping above already surfaced a specific known risk, it's referenced directly so testers know exactly where to start. These areas are the minimum journey checks, not an exhaustive WCAG conformance checklist.

### 4.1 Keyboard

Every interactive element (buttons, tabs, modals, form controls) must be reachable and operable using only a keyboard.

- **Known risk**: The student dashboard's task-list resize divider (`ProjectDashboardComponent`) is currently mouse-drag only (CDK drag-drop) — check whether a keyboard-accessible alternative exists.
- **Method**: Navigate each journey step using Tab/Shift+Tab/Enter/Space/Arrow keys only, no mouse.
- **Evidence**: Screen recording of keyboard-only traversal, noting any unreachable or un-triggerable controls.

### 4.2 Focus

Focus should be visible and not obscured, and should move logically. A modal may contain focus while open, but must provide an operable exit.

- **Known risk**: Modals (`GradeTaskModalComponent`, `UploadSubmissionModalComponent`, `BatchFeedbackWorkflowDialogComponent`) should trap focus while open and return it sensibly on close.
- **Method**: Open/close each modal and confirm focus placement before, during, and after; check focus order across multi-stage flows (e.g. the upload modal's group - details - comments stages).
- **Evidence**: Screen recording or annotated screenshots showing focus indicator position at each step.

### 4.3 Screen Reader

All content and state changes must be announced correctly (NVDA/VoiceOver, per the environment matrix in Section 5).

- **Known risks**: Success messages shown via alert + snack bar (task claiming); tab switching in `TaskDashboardComponent`/`InboxDashboardComponent`; loading states (`inboxLoading` in the staff inbox); the redirect to `/unauthorised` when a role-restricted route is accessed without permission (`role-whitelist.guard.ts`) - confirm the redirect and resulting page are announced clearly, and that the brief loading check beforehand doesn't leave a screen reader user on a blank or ambiguous page.
- **Method**: Navigate each journey step with a screen reader active; confirm dynamic changes (loading, success/error, tab switches, redirects) are announced, not just visually shown.
- **Evidence**: screen recording with screen reader audio, or a transcript of announcements against expected announcements.

### 4.4 Semantics

Correct use of headings, landmarks, lists, buttons vs. links, and ARIA roles/attributes where native HTML isn't sufficient.

- **Method**: Inspect the rendered DOM (browser dev tools or an automated tool) for each journey step.
- **Evidence**: Annotated DOM snapshot or automated scan report per page/step.

### 4.5 Zoom / Text Resize

Content must remain usable at 200% browser zoom and at increased OS/browser text-size settings, with no loss of content or function.

- **Method**: Test each journey step at 200% zoom and at a large text-size setting.
- **Evidence**: Before/after screenshots at default and 200% zoom.

### 4.6 Reflow

For vertically scrolling content, test at **320 CSS px wide**, equivalent to a 1280 CSS px viewport at 400% browser zoom. Content and controls must remain available without scrolling in two dimensions. [WCAG 2.2 SC 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) allows exceptions for content that needs a two-dimensional layout, such as some tables or diagrams; record the specific exception rather than exempting the whole page or its controls.

- **Known risk**: Student pane switching and collapsed comments; staff actions missing from the phone branch (Section 3.2); PDF controls, modals, and the on-screen keyboard covering feedback controls.
- **Method**: Complete each journey at 320 CSS px and at each device viewport in Section 5, including 400% desktop zoom. Check around the staff 600px and student 640px layout boundaries, and the 1000px comments boundary. Test portrait and landscape, including with the on-screen keyboard open.
- **Evidence**: Screenshots or recordings with CSS viewport dimensions, zoom level, orientation, and any justified two-dimensional-content exception recorded.

### 4.7 Contrast

Text and meaningful UI elements must meet **WCAG 2.2 AA** contrast ratios (4.5:1 for normal text, 3:1 for large text/UI components) checked against whichever colour theme/mode is active (excluding dark mode itself, which is out of scope).

- **Method**: Automated contrast check per page/step.
- **Evidence**: Contrast checker output per checked element.

### 4.8 Colour

Information must never be conveyed by colour alone (e.g. status icons/labels in `taskStatusData`, warning/overflow icons in the staff task list).

- **Method**: Review each status/warning indicator and confirm an icon, label, or text equivalent accompanies any colour coding.
- **Evidence**: Screenshot with colour-blindness simulation applied (e.g. a simulator extension), or annotated screenshot noting the non-colour cue.

### 4.9 Motion

As a product expectation, non-essential animation should respect the OS/browser "reduce motion" setting. Also check applicable WCAG requirements for flashing and moving content; enabling reduced motion alone does not establish that those requirements pass.

- **Method**: Enable "reduce motion" at the OS level and repeat each journey step, checking nothing becomes unusable.
- **Evidence**: Screen recording with reduce-motion enabled.

### 4.10 Cognitive Clarity

Plain language, predictable layout, clear error/validation messaging, and minimal unnecessary complexity.

- **Known risk**: The upload submission modal's minimum comment length requirement (25+ characters) and its disabled-submit state - confirm the reason for disablement is clearly communicated, not just visually implied.
- Method: walk through each journey step as a first-time user would, noting any unclear instructions, ambiguous error states, or unexplained disabled controls.
- Evidence: written notes per step, plus screenshots of any unclear or ambiguous UI encountered.

## 5. Test Environment Matrix

---

The matrix below defines repeatable coverage. Record exact browser, OS, assistive-technology, and app-build versions; "latest" alone is not reproducible. Mark an unavailable combination **Not tested**, with an owner for follow-up, rather than inferring a pass from another device.

### Browsers

- Chrome (latest stable) - **Primary**
- Firefox (latest stable)
- Safari (latest stable, macOS) / Edge (latest stable, Windows)

### Operating Systems

- Windows (latest supported release)
- macOS (latest supported release)
- iOS and Android for the mobile-browser and installed-PWA passes below. Record any unavailable platform as a coverage gap.

### Screen Readers

- NVDA (Windows) - **Primary**, (paired with Chrome or Firefox)
- VoiceOver (macOS) - (paired with Safari)
- VoiceOver with Safari on iOS; TalkBack with Chrome on Android. Repeat the journeys in the installed standalone PWA on each available platform, using touch exploration and swipe navigation.
- Additional, as available: JAWS (Windows).

### Viewports

- Desktop: 1920×1080 or 1366×768 CSS px, plus 200% text/zoom and the 400% reflow pass described in Section 4.6.
- Reflow minimum: 320 CSS px wide, independent of whichever phone is available.
- Mobile: 390×844 CSS px as a repeatable browser fixture, plus the actual iOS/Android device dimensions in portrait and landscape. Responsive emulation complements physical-device testing; it does not replace it.

### Mobile app / installed PWA

- Run each journey in a normal mobile browser and after launching the installed OnTrack PWA. Confirm the same build is loaded; a service worker can serve an older bundle (see [service-worker guidance](service-worker.md)).
- Include launch/resume, returning from the file picker or document viewer, browser/device back navigation, safe-area insets, focus after pane changes, touch target usability, large text, and the on-screen keyboard. Verify the selected task survives these transitions and feedback/submission actions remain reachable.
- Record browser versus standalone display mode in every finding. A browser pass must not be reported as an installed-app pass. Document missing staff phone actions from Section 3.2 as an open issue until verified fixed.

Each finding logged against the finding template (Section 7) should record which specific browser/OS/screen-reader/viewport combination it was found in, since accessibility issues can be combination-specific.

## 6. Severity Scale (P0–P3)

---

Each finding is assigned one severity level, based on a combination of four factors:

- How much harm or exclusion it causes.
- Whether it blocks a task entirely.
- How often a user would hit it.
- Whether it affects a shared component used across many pages.
  When factors point to different levels, use the **highest** applicable severity.

### P0 — Blocking

A user relying on assistive technology or an accessibility feature **cannot complete a core task at all** (e.g. cannot submit work, cannot find their grade, cannot navigate past a certain point). No workaround exists within the page.

- **Example**: A modal traps keyboard focus with no way to close or continue.
- **Shared-component impact**: A shared component that blocks a core task with no accessible workaround is P0 across its affected views. Reuse alone does not turn a minor issue into a blocker.

### P1 — Severely Degraded

A core task is **technically possible but significantly harder, slower, or more frustrating** for a user of assistive technology or an accessibility feature - not fully blocked, but a serious barrier.

- **Example**: A status change is made but not announced to screen reader users, forcing them to guess or re-check manually.
- **Example**: Content critical to a decision (e.g. feedback text) is present but not reachable in a logical reading/focus order.

### P2 — Minor Barrier

The task is completable without serious difficulty, but there's a **real, noticeable accessibility problem** - inconsistent focus indication, a contrast ratio just below AA, a redundant or confusing label.

- **Example**: A warning icon relies on colour alone but a text label is present elsewhere on the same row (so the information isn't entirely lost, just less discoverable).

### P3 — Cosmetic / Low Impact

A **minor inconvenience** with negligible effect on task completion - small inconsistencies, non-critical polish issues, or edge cases affecting very few users or very rarely encountered states.

- **Example**: a decorative element lacks `alt=""` but conveys no information.

### Applying the scale

- **Harm**: How seriously does this affect a real user's ability to use OnTrack independently and with dignity?
- **Task-blocking**: Does it stop a task outright, slow it down, or barely register?
- **Frequency**: Is this hit on every use of a page, or only in a rare edge case?
- **Shared-component impact**: Record all affected views and increase triage priority when an issue is widespread. Change severity only when the broader evidence meets that level's harm and task-blocking criteria.

## 7. Finding Template

---

Every accessibility finding logged against this baseline uses the same fields, in the same structure, regardless of who logs it or which journey it comes from. Do not add, remove, or rename fields per-ticket - the structure only stays reusable if it stays fixed.

| Field               | Description                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Route**           | The exact URL/path where the issue was found (e.g. `/units/:unitId/tasks/inbox`). Use the real path pattern from the app, not a paraphrase.                                                                                                                  |
| **Component**       | The Angular **component name** responsible for the affected UI (e.g. `GradeTaskModalComponent`), if known. Helps whoever fixes the issue locate the code quickly.                                                                                            |
| **Steps**           | The exact sequence of actions to reproduce the issue, written so someone unfamiliar with the finding could follow them without guessing (include role/account used, browser/OS/screen reader, and viewport - matching an entry from **Section 5**'s matrix). |
| **Expected Result** | What should happen, per **WCAG 2.2 AA** and/or this baseline's test-area guidance (**Section 4**).                                                                                                                                                           |
| **Actual Result**   | What actually happens - described factually, without severity judgement built into the wording.                                                                                                                                                              |
| **Severity**        | One of **P0–P3**, assigned per the criteria in **Section 6**.                                                                                                                                                                                                |
| **Evidence**        | A screen recording, screenshot, or tool output (e.g. software generated report, contrast checker result) demonstrating the issue. Use demonstration accounts and sanitised data only (see **Section 8**).                                                    |
| **Owner**           | The person or team responsible for triaging or fixing the finding.                                                                                                                                                                                           |
| **Re-test Status**  | Not yet re-tested / Fixed - confirmed / Fixed - not confirmed / Still present / Won't fix (with reason). Updated after a fix is attempted, using the same environment the issue was originally found in wherever possible.                                   |

## 8. Security & Privacy Notes

> **Use demonstration accounts and sanitised evidence only.** No real student, staff, or unit data should appear in any screenshot, recording, or written finding produced during audits against this baseline.

> **Do not use real student assessment content in test-plan examples.** Any example task, submission, or feedback used to illustrate a journey or a finding must be fabricated or clearly marked as a demonstration.

> **Hidden accessibility text is still data exposure.** Content added purely for assistive technology - `aria-label`, `alt` text, visually-hidden spans, and similar - must be checked for unauthorised information the same way visible content is. A hidden label is not a safe place to leak information that shouldn't be shown to the current viewer (e.g. another student's name, an internal-only note, a role-restricted detail). This applies equally to elements found during the journeys above, such as the role-gated Tutor Notes tab (`InboxDashboardComponent`, `TaskDashboardComponent`) - hidden text near those areas should be checked as carefully as the visible UI already is.

## 9. Phase 1 — Definition of Done

### 9.1 What Phase 1 explicitly does not mean

- That any accessibility audit has actually been run - running the audits is separate, future work.
- That any component has been fixed, or that any specific page currently passes **WCAG 2.2 AA**.
- That OnTrack is accessibility-compliant or certified in any formal sense. **WCAG 2.2 AA** is adopted here as a **target to work toward**, not a claim being made about the current state of the site.

### 9.2 Explicitly out of scope for Phase 1

(per this ticket): Running the audits, fixing flagged components, implementing dark mode, purchasing commercial accessibility tooling, and formal legal certification. These are future work, to be scoped as separate tickets once this baseline is in use.

### 9.3 Known open items

For whoever picks up the next piece of work.

- The staff phone branch omits the footer used for claims, status changes, and grading (Section 3.2). Audit and resolve this separately before claiming end-to-end staff mobile support.
- Execute the desktop, mobile-browser, and installed-PWA matrix in Section 5 against the chosen integration build. The source mapping in this document is not evidence of a passing runtime audit.
- Re-test the observations and outstanding independent review in A11Y-V01 where relevant; retain their original evidence and build context rather than duplicating or silently declaring them resolved.

## 10 Phase 1 (this baseline) is complete when

| Requirement                                                                                                           | Result                        | Evidence    |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------- |
| The target standard and scope are written in plain language.                                                          | **Met**                       | Section 1   |
| The plan covers both technical accessibility and cognitive or neurodivergent usability.                               | **Met**                       | Section 1.1 |
| Dark mode is clearly excluded from implementation while contrast and colour use remain testable.                      | **Met**                       | Section 1.2 |
| At least one student journey and one staff journey are mapped from start to finish, with known device gaps recorded.  | **Met (source mapping only)** | Section 3   |
| Every accessibility test area has a repeatable method and a defined evidence type.                                    | **Met**                       | Section 4   |
| The test environment matrix exists that the team can actually reproduce.                                              | **Met**                       | Section 5   |
| The severity scale distinguishes a blocked task from a minor inconvenience.                                           | **Met**                       | Section 6   |
| The findings template exists and can be reused without editing its structure.                                         | **Met**                       | Section 7   |
| Security and privacy expectations for future audit evidence are documented.                                           | **Met**                       | Section 8   |
| The document states that Phase 1 is an improvement and guardrail program, not proof that the whole site is compliant. | **Met**                       | Section 9.1 |

## 11. Known Codebase Notes

---

### AngularJS

- Angular migration in progress - legacy `.coffee` state files and orphaned `.tpl.html`/`.scss` files still exist alongside migrated `.component.ts` files (e.g. `dashboard.tpl`, `task-dashboard.tpl`). Not active code, but can be confusing when browsing.
- Route-vs-template mismatches to expect - old CoffeeScript state definitions may reference templates that no longer exist post-migration.

### Confirmations

- What initially looked like a role-guard inconsistency between the bare `/units/:unitId/tasks` path and `tasks/inbox`/`tasks/definition`/etc. is **not an inconsistency** - <u>they are two different features sharing a URL prefix</u>. The bare `tasks` path renders `TaskViewerStateComponent`, a task-_definition_ viewer (unit-administration-adjacent, correctly restricted to Convenor/Admin/Auditor). The `tasks/inbox` etc. paths render `UnitTaskInboxStateComponent`, which reviews individual student _submissions_ (correctly includes Tutor, since that's core marking work).
- `SelectedTaskService` is shared infrastructure between staff and student views - task-selection state isn't duplicated per role.

### Status and feedback paths

- Student submission processing calls `Task.processTaskStatusChange()` from `UploadSubmissionModalComponent`; the method belongs to the task model.
- Staff footer actions call `Task.updateTaskStatus()`, which may open `GradeTaskModalComponent` before persisting a gradeable status. Staff feedback uses the shared comments viewer and composer, while student grade/quality summaries appear in `TaskAssessmentCardComponent`.

## 12 Coverage

---

### 12.1 Files

|                                        |                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `unit-task-inbox-state.component.ts`   | Confirmed the shared staff inbox/explorer/moderation/overflow component              |
| `app.routes.ts`                        | The authoritative routing file - confirmed all staff route paths                     |
| `inbox-dashboard.component.ts`         | Confirmed the read-only submission viewer                                            |
| `inbox-dashboard.component.html`       | Confirmed no grading action lived there                                              |
| `staff-task-list.component.ts`         | Confirmed task selection, keyboard shortcuts, filtering                              |
| `task-claim.component.ts`              | Confirmed the claim action                                                           |
| `task-status.ts`                       | Confirmed the status vocabulary                                                      |
| `grade-task-modal.component.ts`        | Confirmed the actual grading action                                                  |
| `project-dashboard.component.ts`       | Confirmed the student split-pane layout                                              |
| `task-dashboard.component.ts`          | Confirmed task tabs and staff-view restrictions; comments are outside this component |
| `upload-submission-modal.component.ts` | Confirmed the student submission action                                              |
| `role-whitelist.guard.ts`              | Confirmed guard redirect behaviour                                                   |
| `task-viewer-state.component.ts`       | Resolved the apparent role-guard inconsistency                                       |
| `definitions.coffee`                   | Legacy staff route definition (superseded)                                           |

The completed journey mapping also traces these active sources (paths are relative to this document):

- [Project dashboard template](../src/app/projects/states/dashboard/project-dashboard/project-dashboard.component.html): phone Feedback control and desktop comments sidebar.
- [Staff inbox template](../src/app/units/states/tasks/inbox/inbox.component.html): document/comments views and the desktop-only footer placement.
- [Footer template](../src/app/common/footer/footer.component.html) and [component](../src/app/common/footer/footer.component.ts): claim visibility, status actions, and their enabling conditions.
- [Task model](../src/app/api/models/task.ts): `updateTaskStatus()`, grade-dialog dispatch, persistence, and status-change processing.
- [Comments viewer](../src/app/tasks/task-comments-viewer/task-comments-viewer.component.html) and [composer](../src/app/tasks/task-comment-composer/task-comment-composer.component.ts): feedback display and submission.
- [Assessment card](../src/app/projects/states/dashboard/directives/task-dashboard/directives/task-assessment-card/task-assessment-card.component.html): student grade and quality-point display.

### 12.2 Paths

|                                         |                                                                   |
| --------------------------------------- | ----------------------------------------------------------------- |
| `units/states/tasks/inbox/`             | Revealed the Angular migration                                    |
| `units/states/tasks/inbox/directives/`  | Revealed inbox-dashboard, moderation, staff-task-list, task-claim |
| `projects/states/dashboard/`            | Revealed directives, dashboard.tpl, selected-task.service         |
| `projects/states/dashboard/directives/` | Revealed progress-dashboard, student-task-list, task-dashboard    |
| `task-dashboard/`                       | Revealed `task-dashboard.component.ts` plus legacy files          |
