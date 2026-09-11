# Calendar download: design notes and codebase findings

## Summary

The calendar work adds the ability to download task due dates as an `.ics` file alongside the
existing WebCal subscription (a live feed). It has two intended entry points:

1. The per-unit **Progress Dashboard**, to download the current unit's tasks.
2. The global **calendar modal**, to download across the units a student is enrolled in, using the
   modal's existing unit selection to choose which units/subjects are included.

The download is a one-time file. The WebCal subscription remains the option for a live-updating
feed. The per-unit download and its grade selector are implemented; the cross-unit calendar-modal
download remains follow-on work.

## Placement

### Progress Dashboard (per unit)

- Component: `progress-dashboard.component`
  (`src/app/projects/states/dashboard/directives/progress-dashboard/`), rendered by
  `project-dashboard` at route `projects/:projectId/dashboard`.
- The button fits in the "Plan Your Tasks" card (`task-planner-card.component`), beside "View Task
  Planner". That card already receives the project (`[project]` input) and is about task due dates.
  The implementation lives in that card and injects `FileDownloaderService` and `GradeService`.
- Data readiness: the dashboard route resolves **progressively**. `project.resolver.ts:11` detects
  `/dashboard` after stripping the query string; the progressive branch
  (`project.resolver.ts:23-27`) emits a project stub immediately and loads tasks asynchronously. The
  implementation therefore gates the button with `hasDownloadableTasks` until at least one task for
  the selected grade is available. This differs from the Task Planner route
  `projects/:projectId/plan`, which blocks until mapping completes.

### Calendar modal (across units)

- Component: `calendar-modal.component` (`src/app/common/modals/calendar-modal/`), opened from the
  header calendar entry point and the Task Planner.
- The modal already loads the user's projects:
  `projectService.query(undefined, {params: {include_in_active: false}})`, filtering out explicitly
  inactive teaching periods while retaining projects without teaching-period metadata
  (`calendar-modal.component.ts:56-60`), held as `projects: Project[]` (`ts:30`).
- The modal already has a unit include/exclude mechanism backed by `webcal.unitExclusions`:
  `includedProjects` / `excludedProjects` getters (`ts:205-222`) and `includeExclusion` /
  `removeExclusion` (`ts:227-246`), rendered as removable unit chips
  (`calendar-modal.component.html:52-77`).
- The modal already exposes the live feed URL (`webcalUrl` + `.ics`,
  `calendar-modal.component.html:190`).
- Projects returned by `query()` are list summaries and do not carry loaded task caches. A
  client-side multi-unit build would need to load each unit's tasks first.

## Date resolution

- Resolve a task's date by calling `Task.localDueDate()`. Do not read `Task.dueDate`,
  `TaskDefinition.dueDate`, or `TaskDefinition.targetDate` directly as a shortcut around it.
- On `TaskDefinition` the field names are inverted relative to their meaning: `localDueDate()`
  returns `targetDate` (`task-definition.ts:180`), while `localDeadlineDate()` and
  `finalDeadlineDate()` return `dueDate` (`task-definition.ts:221, 245`). `dueDate` is the deadline;
  `targetDate` is the due/target date.
- `Task.localDueDate()` (`task.ts:294-312`) is the correct resolver. It handles flexible dates, the
  student's custom target date, and grade target dates, and falls back through `dueDate` to
  `definition.localDueDate()`. The shared event builder (`calendar-event-builder.ts`) already calls
  it and returns a `YYYY-MM-DD` civil-date string, which avoids a daylight-saving off-by-one that a
  `Date`-instant path would introduce.

## ICS generation

- No third-party ICS/iCalendar generation library is used. `ics-calendar-builder.ts` builds the
  `VCALENDAR`/`VEVENT` text from the shared `calendar-event-builder.ts` result.
- Text escaping follows RFC 5545 section 3.3.11, with backslash first: `\`->`\\`, `;`->`\;`,
  `,`->`\,`, and every CR/LF form ->`\n`. Content lines use CRLF and are folded at 75 UTF-8 octets
  without splitting a Unicode code point. Each `VEVENT` carries a UTC `DTSTAMP`.
- All-day dates use the `YYYYMMDD` form. `DTSTART` is the task's civil due date and `DTEND` is the
  following civil date because RFC 5545 defines `DTEND` as exclusive and later than `DTSTART`. This
  deliberately corrects the legacy WebCal backend's equal-start/end convention; the same
  exclusive-end rule is also required by the Google Calendar template URL.
- Events also carry `STATUS:CONFIRMED`, `X-DOUBTFIRE-UNIT` (unit id), `X-DOUBTFIRE-TASK` (task
  definition id), and a `UID` of the form `E-<taskDefinitionId>`.

## Download mechanisms

Two approaches exist in the codebase:

- URL-based: `FileDownloaderService.downloadFile(url, filename)` (`file-downloader.service.ts:152`)
  fetches a URL and saves the response as a file. This suits saving the existing WebCal feed URL
  directly, in which case the server produces the `.ics` and the unit selection is already applied
  by `unitExclusions`.
- In-memory: build the string, `new Blob([ics], {type: 'text/calendar;charset=utf-8'})`,
  `URL.createObjectURL`, then `FileDownloaderService.downloadBlobToFile(url, filename)`
  (`file-downloader.service.ts:141`) and `releaseBlob(url)` (`file-downloader.service.ts:130`). The
  per-unit download uses this approach. An equivalent self-contained pattern is used for CSV export
  at `students-list.component.ts:140-156`.

## Grade and task-status fields

- Grade values: Fail -1, Pass 0, Credit 1, Distinction 2, High Distinction 3 (`unit.ts:91-95`,
  `grade.service.ts`).
- Per-task grade: `task.definition.targetGrade`. Limit to a target grade with
  `task.definition.targetGrade <= grade`. `Project.activeTasks()` (`project.ts:182`) applies this
  against the saved `project.targetGrade`; `unit.taskDefinitionsForGrade(grade)` (`unit.ts:239`) is
  the definition-level equivalent.
- `project.tasks` (`project.ts:125`) is unfiltered; a grade-limited download must apply the filter
  explicitly.
- Task completion: `task.inFinalState()` (`task.ts:670`) returns
  `TaskStatus.FINAL_STATUSES.includes(status)`. `task.submissionDate` is available where a
  "submitted" predicate is preferred.

## Feature status and scope

- Implemented: download a unit's calendar from the Progress Dashboard as an `.ics` file.
- Implemented: select a target grade for that unit download without changing the student's saved
  target grade.
- Follow-on: download from the calendar modal across the user's included units/subjects.
- Follow-on: optionally exclude completed tasks from either download.

## Related existing behaviour

The WebCal subscription generates events server-side (`doubtfire-api` `webcal.rb`) and already
filters by target grade and by unit exclusions. The download reuses the shared event builder's bare
title, civil date, and UID. That title/UID pairing matches the server feed only when
`include_start_dates` is off; when it is on, the feed also emits `Start:` events and prefixes end
events with `End:`. The one-time download deliberately does not recreate that reminder-style
variant. Its exclusive next-day `DTEND` is intentionally standards-compliant even though the legacy
server feed currently emits equal start and end dates.
