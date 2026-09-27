# THM-M02 - Core student workflow theme migration

**Ticket:** THM-M02 - Migrate the core student workflows to Light, Dark, and System themes
**Repository:** doubtfire-web
**Branch:** `theme/student-workflows`, based on `origin/11.0.x`
**Depends on:** THM-M01 merged

## Dependency status

- **THM-M01 (shell and shared components): merged.** PR #136 merged THM-M01 into
  `feat/theme-foundation`, and PR #188 merged `feat/theme-foundation` into
  `11.0.x` on 2026-09-14. All the M01 token files and the `ThemeService` are
  present in `11.0.x`, so this branch is based on `11.0.x` and reuses those shared
  tokens rather than adding a new palette.
- **THM-D01 (theme audit and final student route list): not started.** The card's
  item 1 asks to confirm the final student route list from THM-D01, but that card
  has not produced a list. Following the THEME-MVP-VALIDATION-PLAN, which says the
  route list can be enumerated from the router, the student routes below were read
  from `src/app/app.routes.ts`. This list must be reconciled with THM-D01 when it
  is delivered.

## Student route coverage

Enumerated from the router, restricted to student-facing routes and the shared
surfaces students use.

| Student surface                   | Route or component                                                                                    | Migrated                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Project and task dashboard        | `dashboard` -> `CrossDashboardComponent`, `projects/.../dashboard` -> `project-dashboard`             | Yes                                                                |
| Task dashboard and status card    | `task-dashboard`, `task-status-card`                                                                  | Yes                                                                |
| Task list                         | `project-tasks-list`                                                                                  | Yes                                                                |
| Feedback, comments, discussion    | `task-comments-viewer` and its comment, extension and SCORM comment children, `comment-bubble-action` | Yes                                                                |
| Comment composer                  | `task-comment-composer`                                                                               | Yes                                                                |
| Progress widgets                  | `progress-dashboard` directives, `engagement-detail-dialog`                                           | Yes for the files that carried colour; the rest already use tokens |
| Unit and task navigation dropdown | `task-dropdown`                                                                                       | Yes                                                                |

## What changed

Colour was locked to light in three ways, and all three were migrated so the same
markup now flips correctly in Light, Dark and System. No task, status, submission, extension or feedback logic was changed. The emoji
picker now follows the resolved theme.

1. **Hardcoded colour values in component SCSS** (hex, rgb) replaced with the
   shared M01 tokens.
2. **Named CSS colours in SCSS** (`black`, `grey`) that a hex scan missed, for
   example the discussion status label `.hr-text { color: black }`, replaced with
   tokens so the text is readable in Dark.
3. **Hardcoded Tailwind light utility classes in templates**
   (`bg-white`, `bg-gray-100`, `bg-neutral-100`, `text-black`, `text-gray-500`,
   `text-slate-500`, `border-gray-200`, and the striped `odd:bg-gray-100 even:bg-white`
   rows on the Learning Outcomes table) replaced with token arbitrary values such
   as `bg-[var(--ot-color-surface)]` and `text-[color:var(--ot-color-text-muted)]`.
   These flip automatically because the token flips, so no per-class `dark:`
   variant was needed.

Examples of the mapping:

- Text and muted text -> `--ot-color-text`, `--ot-color-text-muted`.
- Surfaces and page backgrounds -> `--ot-color-surface`, `--ot-color-page`.
- Borders and dividers -> `--ot-color-border`, `--ot-color-divider`.
- Focus outlines -> `--ot-color-focus`.
- Primary and selected states -> `--ot-color-primary`, `--ot-color-selected`.
- Disabled states -> `--ot-color-disabled-text`.
- Translucent highlights and glows -> `color-mix(in srgb, var(--ot-color-...) N%, transparent)`.
- Neutral drop shadows using `rgba(0,0,0,...)` were left as they read correctly on
  both grounds.

### Files migrated

- `src/app/projects/states/dashboard/project-dashboard/project-dashboard.component.scss`
- `src/app/projects/states/dashboard/directives/task-dashboard/task-dashboard.component.scss`
- `src/app/projects/states/dashboard/directives/task-dashboard/directives/task-status-card/task-status-card.component.scss`
- `src/app/projects/states/dashboard/directives/progress-dashboard/engagement-passport-card/engagement-detail-dialog/engagement-detail-dialog.component.scss`
- `src/app/tasks/project-tasks-list/project-tasks-list.component.scss`
- `src/app/tasks/task-comment-composer/task-comment-composer.component.scss`
- `src/app/tasks/task-comments-viewer/task-comments-viewer.component.scss`
- `src/app/tasks/task-comments-viewer/comment-bubble-action/comment-bubble-action.component.scss`
- `src/app/tasks/task-comments-viewer/extension-comment/extension-comment.component.scss`
- `src/app/tasks/task-comments-viewer/scorm-comment/scorm-comment.component.scss`
- `src/app/tasks/task-comments-viewer/scorm-extension-comment/scorm-extension-comment.component.scss`
- `src/app/common/header/task-dropdown/task-dropdown.component.scss`

### Templates migrated (Tailwind light classes to tokens)

- `task-ilos-card.component.html` (the Unit and Task Learning Outcomes card, the
  striped rows that stayed light in Dark)
- `progress-dashboard.component.html` (the Progress Dashboard header strip)
- `task-dashboard.component.html`, `project-dashboard.component.html`
- `project-tasks-list.component.html`
- `engagement-passport-card.component.html`, `engagement-detail-dialog.component.html`,
  `add-engagement-dialog.component.html`, `peer-progress-unit-summary.component.html`,
  `download-filter-dialog.component.html`
- `create-portfolio-task-list-item.component.html`, `task-planner-prerequisites-modal.component.html`
- `portfolio-grade-select-step.component.html`, `portfolio-learning-summary-report-step.component.html`,
  `portfolio-included-tasks.component.html`
- `task-assessment-comment.component.html`
- `unit-task-list.component.html` (the task list shown in the task-detail view, whose selected row used a hardcoded `bg-blue-50`)
- `engagement-passport-card.component.html` (the current-week column highlight)

## Non-colour cues

- Task status is shown by a `status-icon` and the `statusLabel()` text in the
  status card, not by colour alone.
- Due-date urgency uses the `--ot-urgency-*` tokens, and the surrounding wording
  states the date, so meaning does not depend on colour.

## Deferred, with suggested follow-up tickets

These carried colour but are out of THM-M02 scope or owned by an active ticket, so
they are recorded here rather than changed, as the card requires.

| File or area                                                                                                                | Reason                                                                                                                                      | Suggested follow-up                                                            |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `task-description-card/ppi-widget`                                                                                          | Owned by the active PPI feature                                                                                                             | THM-M02-R1: theme the PPI widget with the feature owner                        |
| `common/header/header.component.scss`, `notification-bell`                                                                  | Header shell is THM-M01, the bell is the notifications feature                                                                              | THM-M02-R2: finish the header badge and bell with M01 and notifications owners |
| `tasks/.../task-upload-requirements` and the upload modal                                                                   | Upload is named in the cross-objective boundary and is feature-owned                                                                        | THM-M02-R3: theme the upload surfaces with the upload owner                    |
| Staff surfaces under `units/states/edit`, `units/states/tasks/inbox`, `projects/states/tutor-*`, `staff-notes`, `analytics` | Staff-only pages, out of scope                                                                                                              | THM-M03 (tutor, unit chair and admin surfaces)                                 |
| `units/task-viewer` wrapper                                                                                                 | The shared `unit-task-list` child is migrated here and used by the student dashboard; staff-only wrapper surfaces remain outside this scope | THM-M03 for remaining staff wrapper surfaces                                   |

## Original checks — 2026-09-14 (historical)

Run inside the Docker web container on 2026-09-14. Node 22.23.2, Angular CLI
22.0.9, vitest 4.1.9.

| Check         | Command                                                                    | Result                                 |
| ------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| SCSS compiles | `sass --no-source-map --load-path=src <each changed file>`                 | 12 of 12 pass                          |
| App bundle    | produced by the test builder while running the targeted test               | Application bundle generation complete |
| Targeted test | `ng test --watch=false --include='.../task-status-card.component.spec.ts'` | 1 file, 1 test passed                  |
| Typecheck     | `ngc -p src/tsconfig.app.json --noEmit`                                    | exit 0, no errors                      |
| Lint          | `ng lint --max-warnings 0`                                                 | All files pass linting                 |

The full production `ng build` was killed by the Docker VM memory limit during
the minify step. It is an environment constraint, not a code error: the same
sources compile cleanly under the test builder above, which produced a complete
application bundle. Re-run `ng build` on a machine with more memory to capture the
production build log for the PR.

### Original visual verification (historical)

The running dev server (`ng serve`) recompiled all SCSS and template changes
without error, and the student unit dashboard and task-detail view were checked
in Light and Dark. Confirmed fixed in Dark: the Unit and Task Learning Outcomes
striped rows, the Progress Dashboard header strip, the discussion status labels,
the selected and hovered task rows on both the dashboard list and the task-detail
list, and the Engagement Passport current-week column highlight.

## Evidence screenshots

Captured on a student account with mock data. Stored in
`docs/theme/screenshots/`.

| File                                        | View                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `home-light.png`, `home-dark.png`           | Enrolled units home in Light and Dark                                             |
| `dashboard-light.png`, `dashboard-dark.png` | Student unit dashboard with task list, progress panels and Unit Learning Outcomes |
| `task-detail-dark.png`                      | Task details, learning outcomes and the discussion panel in Dark                  |
| `calendar-web-dark.png`                     | Web calendar dialog in Dark                                                       |

## Evidence to attach to the PR

- This coverage list.
- The Light and Dark screenshots above.
- The check output above.
- The residual follow-up tickets.

## Maintainer review and integration — 2026-09-20

The branch was integrated with `11.0.x` at `d16f6201c`, preserving the merged
preferred display names and task-list accessibility labels. The migration is
additional to the shared theme foundation and the merged staff inbox work. The
related study-view PR #223 is closed without a merge; its existence does not make
these changes duplicates of the current base.

The review corrected the following theme issues:

- Active mobile tabs, selected sort options, current-week engagement labels and
  dates in selected task rows use the matching selected foreground token.
  Current-week text uses mutually exclusive Tailwind utilities so the global
  utility `!important` rules cannot override the selected foreground.
- Discussion, extension and SCORM status text uses opaque muted text. The fade
  remains on decorative lines. Own-comment reply snippets use opaque on-primary
  text, avoiding reduced contrast on the Dark primary background.
- The due-soon badge uses paired status background and foreground tokens; other
  due-date text uses urgency tokens. Icons and wording still distinguish states.
- The composer buttons, emoji control and remaining engagement text use theme
  tokens. The emoji picker follows the resolved ThemeService signal, including
  System mode, rather than being fixed to Light.

Validation used Node 22.23.2 and dependencies installed from the current lockfile.
The full suite passed **1,076 tests in 144 files**; the targeted theme, composer,
mobile dashboard, comments and task-list runs passed **117 tests**. Angular
`ngc` typecheck, full lint and compilation of all 14 changed SCSS files passed.
The production build passed with existing component-size, CommonJS and
minification warnings; no budget was raised. The original Docker build limitation
above is historical, and is superseded by this production-build result.

The browser contrast checks used **representative component fixtures**, the actual
compiled component styles and generated production utility styles. They covered
320, 390 and 1,280 CSS-pixel widths in Light, Dark and System, including an OS
light/dark change. These checks verify the shared browser/PWA styles, contrast and
48-pixel phone composer targets; they are not a full authenticated route or
physical-device test. The author screenshots above are historical route captures
with mock data and predate these review fixes; they are not screenshots of this
fixture or proof of the final mobile layout. No native mobile application was
built or tested by this PR.
