# Theme audit, integration scope and regression checks

Repository baseline: `11.0.x` at `a35f2826ddff8a816175490c108f1794779c3254`, inspected 20 September 2026. This document covers the GitHub deliverables for THM-D01, THM-JL01, THM-T01, THM-M04, the automated part of THM-Q01 and PR-THM-20. It is not a maintainer approval, independent accessibility assessment, or release sign-off.

## Integration and ownership

The current theme foundation, account reconciliation and preference control are already in `11.0.x`. This change targets that same branch. It does not create a second theme integration branch or change backend preferences. Existing storage, access checks, status semantics, upload policy and calendar rules are preserved.

| Work                        | Existing owner or boundary                                                           | Delivery in this change                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| D01 audit                   | Theme contributors; reuse the architecture in [THEME-CONTRACT.md](THEME-CONTRACT.md) | Reproducible current-source inventory, ranked blockers and route matrix below                                                      |
| JL01 objective coordination | Objective lead and repository maintainers                                            | GitHub scope, dependency/ownership boundaries and proposed merge target recorded; no claim of written human approval               |
| T01 regression              | Theme contributors, existing Angular/Vitest workflow                                 | First-paint tests, service/browser tests, editor readiness/live change/cleanup tests, compiled styles and semantic contrast checks |
| M04 special surfaces        | Theme owns presentation; CAL/FILE own behavior                                       | Calendar/Gantt palette bridges, Monaco palette API, emoji control, chart chrome, PDF surroundings, browser chrome and print tokens |
| Q01 independent validation  | Independent student-facing and staff-facing reviewers                                | Reproducible matrix and automated results; human/browser/assistive-technology checks remain reviewer work                          |
| PR-THM-20                   | Theme and security reviewers                                                         | Matching CSP dependency comments beside the existing boot script and Nginx header                                                  |

The foundation precedes special surfaces and page migrations; regression checks evolve with each batch; independent validation precedes any release decision. The historical D01 → D02 → F01 order is retained for future design changes, but D02/F01 have already landed. This report reconciles that older plan with current code rather than reimplementing them.

Merged student workflow PR [#244](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/244), authored by Swyam Khare, owns M02 student component migrations and the task-list mixin. It merged during this implementation, and this branch was rebased onto it. Its work is preserved. Existing MG-04/MG-05 catalogue/style-guide work remains owned by those tickets; the [existing validation plan](THEME-MVP-VALIDATION-PLAN.md) and contract are preserved. The subsequent reconciliation located the existing [MG-04 catalogue](../migration/ui-catalogue.md) and [MG-05 style guide](../css-style-guide.md). Reuse the [dated attribution and theme-impact crosswalk](../objective-closure/AUDIT-AND-FOLLOWUPS.md); do not duplicate their inventories.

The current preference values remain `light`, `dark`, `system`; System tracks live OS changes. Existing phase-two account sync is retained. The initial MVP's earlier local-enum-only statement is historical, not an instruction to remove subsequently merged account functionality.

## Reproducible audit

Run from the repository root:

```sh
node scripts/theme/audit-colours.mjs a35f2826ddff8a816175490c108f1794779c3254 > theme-baseline.json
node scripts/theme/audit-colours.mjs > theme-current.json
```

Baseline counts: **1,236 raw candidates**, **148 unique files**, **107 unique component directories**. Categories: 552 semantic candidates, 242 special-surface candidates, 55 decorative candidates, 352 palette definitions, 34 comments/examples and 1 print/browser candidate. These counts are not confirmed defect totals.

The JSON includes every candidate's file, line, literal and preliminary classification, plus raw count, unique file count and unique component-directory count. SCSS, HTML and TypeScript are scanned; tests and obsolete CoffeeScript are excluded. A raw hit is not a defect: comments, palette definitions, brand/decorative values, HTML identifiers and data-series colours need human classification. Deduplicated directories are a reproducible proxy for components, not an assertion that every directory is one component. Tailwind utilities and named black/white/grey declarations are included; the script does not claim to be a full CSS parser.

Active layers: `angular.json` loads `src/theme.scss` and `src/styles.scss`. The latter imports the token palettes and special-surface bridge. `src/styles/m3-theme.scss` remains generated/inactive: its import is commented out. Material light/dark themes remain in `src/theme.scss`; Tailwind and legacy component styles coexist. `src/index.html` resolves the first-paint marker before styles; `ThemeService` maintains it at runtime. The static PWA manifest cannot express a per-user preference. Existing maskable icons are preserved.

## Ranked findings and migration map

| Priority / impact / risk               | Surface and concrete baseline blocker                                                          | Classification and token/action                                                                                                    | Owner / batch                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| High / all roles / low                 | `src/index.html` fixed browser theme colour and `ThemeService.applyResolved` did not update it | Browser colour → page token at boot and every resolved change                                                                      | Theme M04, fixed here                                                             |
| High / submission viewing / medium     | `archive-viewer`, submission comparison and Overseer Monaco options specify `vs`               | Third-party palette → Monaco `vs`/`vs-dark` API, preserve models/undo                                                              | Theme M04, fixed here by shared directive                                         |
| High / task planning / medium          | Worktile Gantt defaults to white background/grey labels                                        | Third-party chrome → public `--gantt-*` variables mapped to semantic tokens                                                        | Theme M04, fixed here; CAL retains bar meaning                                    |
| High / staff scheduling / medium       | Angular calendar default white surfaces, fixed grid and today highlight                        | Third-party chrome → `cal-theme` palette; narrow hover override where Sass colour arithmetic cannot take CSS variables             | Theme M04, fixed here                                                             |
| High / charts / low                    | ngx-charts SVG labels/legend selected text default to black, fixed grid                        | Text/border → text and chart-grid tokens; data series remain owned by their status contract                                        | Theme M04, fixed here                                                             |
| Medium / feedback / low                | Emoji picker forced `darkMode=false` before M02                                                | Supported `darkMode` input follows resolved preference                                                                             | Theme M04, fixed here                                                             |
| Medium / document viewing / low        | `pdf-viewer-panel.component.scss` uses `#d1d1d1`                                               | Surface → page token; submitted pixels/iframe content are not inverted                                                             | Theme M04, fixed here                                                             |
| Medium / printing / low                | Dark semantic tokens remain active when printing                                               | Print → full light token mixin; no stored preference changes                                                                       | Theme M04, fixed here                                                             |
| Medium / deployment / low              | Nginx CSP has no `script-src`; boot script requires inherited `unsafe-inline`                  | Security dependency → paired comments; hash or per-response nonce before policy tightening                                         | PR-THM-20, fixed here                                                             |
| High / student journey / medium        | Student task/feedback templates previously contained light Tailwind utilities                  | Semantic colours → existing M02 migration                                                                                          | Merged PR #244, preserved                                                         |
| Medium / export / medium               | Gantt PNG inherited the on-screen palette and conflicting fixed text utility                   | M04 follow-up: capture uses scoped light tokens; foreground follows the existing bar state without a competing fixed white utility | Fixed in #273; actual PNG/PDF evidence in the closure report; CAL rules unchanged |
| Medium / PWA / external                | Manifest splash/install colour is static `#3939ff`                                             | Brand/browser: retained brand colour before page execution; loaded/offline-cached app uses boot+runtime colours                    | Theme reviewers; static manifest limitation                                       |
| Separate / legacy migration / external | Obsolete CoffeeScript styles and inactive generated M3 file                                    | Related migration, not active theme defects                                                                                        | MG-04/MG-05; no duplicate migration                                               |

Status, urgency, warning and error colours are semantic rather than branding. Preserve visible labels/icons and selected/hidden states: the burndown legend continues to strike through hidden series; warnings and errors require their existing words. Automated token checks do not prove that every status or chart is understandable without colour. Scan QR codes in both appearances: code pixels and quiet zones must not be filtered or inverted. Material date pickers/dialogs reuse the active Material theme rather than a second override layer.

## Repeatable test commands

```sh
npx ng test --watch=false --include='src/app/common/theme/*.spec.ts'
npx vitest run scripts/theme/theme-surfaces.spec.ts
npm run typecheck
npm run lint
npm run build -- --configuration production
```

Use the Angular builder for Angular specs: direct Vitest does not compile Angular templates. The standalone Vitest file executes the actual inline script in a sandbox (valid/invalid/unset storage, blocked storage, absent `matchMedia`), compiles the special-surface Sass, checks print override ordering and measures text/link/action token contrast. Service tests cover storage failures, root marker/colour-scheme, explicit and System changes, listener cleanup and account reconciliation. The editor directive tests delayed loading, live palette changes and teardown without changing document models. Existing selector tests cover named radio choices, stored selection and service writes; native browser keyboard interaction still belongs to the matrix below.

No new testing dependency or separate CI pipeline is introduced. The Sass test uses installed Sass and Vitest. Palette contrast checks cover normal/muted/link text against all three semantic surfaces and primary action text (4.5:1), plus focus/border separation (3:1); they do not certify chart series, disabled exemptions, every status token, or third-party rendering.

## Visual and independent review matrix

Reuse the accessibility objective baseline from merged PR [#243](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/243) and the existing [PPI accessibility checklist](../ppi-accessibility-review-checklist.md) for chart focus, keyboard and non-colour cues; this is a theme-specific extension, not another full accessibility audit.

Use sanitised local fixture accounts and a synthetic unit containing a short/long task title, overdue/future/completed tasks, sample PDF/code/image files, an empty task and a failed request. Never commit cookies, tokens, identifiable student work or private URLs. Record the tested commit, OS/browser version, fixture state and screenshot for every executed row; leave unrun rows unrun.

Record representative applicable coverage across **Light, Dark, System-light, System-dark**, **1440×900 and 390×844**, **100% and native 200% zoom**, and **Chromium, Firefox, Safari where available**, with unrun combinations and reasons visible. The dimensions define the matrix; they do not require every possible Cartesian-product row to execute before the T01 test pack is published. For System, change the OS appearance while the page stays open and confirm the selected preference remains System. Check normal, loading, empty, error, disabled, selected, warning and destructive states where supported.

| Role / route                                                         | Surface/state checks                                                                              | Initial source finding / current review requirement                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Signed out: `/sign_in`, `/timeout`, `/unauthorised`                  | No-flash direct load, blocked storage, expired session, visible focus/error words                 | Boot fixed; actual browser paint and focus unrun                                          |
| All: `/edit_profile`, `/home`, `/notifications`                      | Radio initial state, Tab/arrow/Space selection, names/checked states, long labels, dialog/overlay | Existing selector foundation; manual keyboard/screen reader unrun                         |
| Student: `/projects/:projectId/dashboard`                            | Chart axes/legend, hide/show series, selected task, warnings, empty/error progress                | Chart chrome fixed; student template migration is merged via PR #244                      |
| Student: `/projects/:projectId/plan`                                 | Gantt weekends/today/grid, selected/hover/focus bars, narrow scroll, PNG and print                | Gantt palette bridge fixed; manual capture and print unrun                                |
| Student/staff: task feedback and submission files dialog             | PDF loading/error/download, code/diff selection and undo after a live switch, emoji search        | Editor/PDF/emoji chrome fixed; real renderer checks unrun                                 |
| Student: `/projects/:projectId/portfolio`                            | File selection, loading/error, review/download                                                    | Preserve FILE behavior; visual check requires fixture                                     |
| Tutor: `/units/:unitId/tasks/inbox` and moderation                   | Marking/status words, destructive dialog, document/feedback viewing                               | Shared viewers fixed; complete marking route review unrun                                 |
| Tutor: `/units/:unitId/analytics`                                    | Calendar week/day headers, events, today marker, grid/tooltip and chart labels                    | Calendar/graph bridge fixed; event contrast remains data dependent                        |
| Tutor: `/tutor-discussion`                                           | QR scanning, readable instructions/buttons, camera denied/error                                   | Preserve QR content; hardware/browser check unrun                                         |
| Chair: `/units/:unitId/admin/tasks`                                  | Overseer code/resources, date picker, invalid field, read-only state                              | Monaco and Material palettes; screen reader and zoom review unrun                         |
| Admin: `/admin/users`, `/admin/units`, `/admin/institution-settings` | Tables, selection, disabled actions, errors, destructive confirmation                             | Shared Material/token foundation; no route-level no-blocker claim without execution       |
| Installed/offline                                                    | Cached direct route, app update prompt, browser theme colour, splash, refresh                     | Runtime/boot colours fixed; static splash is branded; offline/PWA browser execution unrun |

For each route verify text/control/focus contrast, keyboard reachability, meaningful names/checked state, non-colour status cues, wrapping at zoom and no clipped critical actions. Retest each blocker after a fix. An independent student-facing reviewer and staff-facing reviewer should confirm they can find and understand Light/Dark/System; this is deliberately not represented as completed by an implementation agent.

GitHub implementation may be reviewed independently of release readiness. Automated checks alone support no release go/no-go decision: browser, assistive-technology, role/fixture and independent usability results remain explicitly unrun until a reviewer records them.
