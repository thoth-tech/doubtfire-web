# CAL-T01: Test coverage for the calendar features

Each calendar feature shipped with its own unit tests, so this note records the coverage rather than adding a separate suite.

| Feature | Spec | Covers |
|---|---|---|
| CAL-F03 event builder | `calendar-event-builder.spec.ts` | the `localDueDate()` fallback chain, the no-due-date null case, and raw (unescaped) title output |
| CAL-F01 Google Calendar button | `task-description-card.component.spec.ts` | button visibility, the keyboard handler, the built href, and mock isolation |
| CAL-F02 .ics download | `ics-calendar-builder.spec.ts` and `task-planner-card.component.spec.ts` | escaping, `DTSTART` on the due date with an exclusive next-day `DTEND` (including across a year boundary), `YYYYMMDD` format, `STATUS` / `X-DOUBTFIRE-*` / `UID`, null-date skip, CRLF, a valid VCALENDAR envelope, `DTSTAMP`, and the disabled/enabled guard plus the download call chain |
| CAL-F06 grade selector | `task-planner-card.component.spec.ts` | the default grade, the highest-grade fallback, non-persistence, `hasDownloadableTasks`, the filename, and a discriminator proving the grade filter is applied |
| CAL-F07 exclude completed | `task-planner-card.component.spec.ts` | excluded-when-on, included-when-off, composition with the grade filter, the guard, the filename suffix, and an ICS-content discriminator |
| CAL-F08 download a copy | `calendar-modal.component.spec.ts` | downloads with an enabled calendar and a guid, and the disabled and no-guid guards |

Each feature includes at least one discriminating test, one that fails if the behaviour were bypassed rather than merely present. Every listed spec that installs Vitest spies uses `afterEach(() => vi.restoreAllMocks())` so those spies do not leak between tests in a file; `calendar-event-builder.spec.ts` installs no spies and therefore needs no cleanup hook.

Conclusion: dedicated test coverage for the calendar work is satisfied by the specs that shipped with each feature PR, so no separate suite is required. This ticket is closed by documenting that coverage.
