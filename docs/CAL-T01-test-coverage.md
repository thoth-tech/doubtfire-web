# CAL-T01: Test coverage for the calendar features

Each calendar feature shipped with its own unit tests, so this note records the coverage rather than adding a separate suite.

| Feature                             | Spec                                                                     | Covers                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CAL-F03 event builder               | `calendar-event-builder.spec.ts`                                         | the `localDueDate()` fallback chain, the no-due-date null case, and raw (unescaped) title output                                                                                                                                                                                           |
| CAL-F01 Google Calendar button      | `task-description-card.component.spec.ts`                                | button visibility, the keyboard handler, the built href, and mock isolation                                                                                                                                                                                                                |
| CAL-F02 .ics download               | `ics-calendar-builder.spec.ts` and `task-planner-card.component.spec.ts` | escaping, `DTSTART` on the due date with an exclusive next-day `DTEND` (including across a year boundary), `YYYYMMDD` format, `STATUS` / `X-DOUBTFIRE-*` / `UID`, null-date skip, CRLF, a valid VCALENDAR envelope, `DTSTAMP`, and the disabled/enabled guard plus the download call chain |
| CAL-F05/F06 grade selector          | `task-planner-card.component.spec.ts`                                    | the default grade, the highest-grade fallback, non-persistence, `hasDownloadableTasks`, the filename, actual downloaded Blob content for all four grades in both directions (including HD-only), and a discriminator proving the grade filter is applied                                   |
| CAL-F07 exclude submitted/completed | `task-planner-card.component.spec.ts`                                    | excluded-when-on, included-when-off, composition with the grade filter, the guard, the filename suffix, all submitted/final states, resubmission states retained as outstanding, invalid/missing due dates, and an ICS-content discriminator                                               |
| CAL-F08 download a copy             | `calendar-modal.component.spec.ts`                                       | downloads with an enabled calendar and a guid, and the disabled and no-guid guards                                                                                                                                                                                                         |

Each feature includes at least one discriminating test, one that fails if the behaviour were bypassed rather than merely present. Every listed spec that installs Vitest spies uses `afterEach(() => vi.restoreAllMocks())` so those spies do not leak between tests in a file; `calendar-event-builder.spec.ts` installs no spies and therefore needs no cleanup hook.

## Focused verification on 21 September 2026

The additional dialog tests check the persistent live result count, focus configuration, actual Material switch/units controls, named and keyboard-reachable removal actions, and their saving guards. ICS tests include leap-day and Melbourne daylight-saving boundaries.

Run the focused suite on Node 22 or the repository-supported runtime:

```sh
npm run test:ci -- --include='src/app/**/*calendar*.spec.ts' --include='src/app/**/task-planner-card.component.spec.ts' --include='src/app/**/download-filter-dialog.component.spec.ts' --include='src/app/**/task-description-card.component.spec.ts'
```

On a busy shared host, use `--runner-config=/tmp/calendar-vitest.config.mjs` containing `export default {test: {maxWorkers: 1, fileParallelism: false}};` and `NG_BUILD_MAX_WORKERS=2`. The initial unrestricted run exhausted worker startup timeouts before executing any tests; it was not a feature failure. The successful limited-worker run passed **7 files / 110 tests**. After explicitly setting the removal button tab index and adding Enter/Space assertions, the modal-only follow-up passed **1 file / 16 tests**. Changed TypeScript and templates also pass ESLint.

The [compatibility fixture](calendar/calendar-compatibility.ics) was generated from the real production builder and checked for four events, CRLF, 75-octet line limits and the exclusive new-year end date. The [mockup](calendar/calendar-controls.svg) was rendered and visually inspected. These checks do not replace the unperformed client imports or screen-reader pass documented in [CAL-C01](CAL-C01-calendar-compatibility.md) and [CAL-A01](CAL-A01-accessibility-verification.md).
