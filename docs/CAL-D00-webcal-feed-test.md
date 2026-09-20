# CAL-D00: What the existing WebCal feed produces

Before treating the WebCal feed as limited, this records what the implementation generates based on the source (`doubtfire-api/app/models/webcal.rb`). Live calendar-client verification is still required and is tracked below.

## Feed shape

The feed is a single per-student iCalendar (`Webcal#to_ical`). The calendar declares a product id from the institution config. API PR #147 corrects the refresh value to `PT4H` on both `X-PUBLISHED-TTL` and `REFRESH-INTERVAL`. This is a four-hour refresh hint; each calendar client decides when it actually refreshes.

## Which tasks appear

`Webcal#task_definitions` selects the task definitions for the student's enrolled, active projects, in active and currently-running units, and applies two filters:

- units the student has excluded are left out (via `WebcalUnitExclusion`),
- only task definitions at or below the student's target grade for that unit are included (`task_definitions.target_grade <= projects.target_grade`).

## Events per task

Each task definition produces one **end (due) event**, and also a **start event** if the student has enabled start dates.

- **Title:** `"{unit code}: {task abbreviation}: {task name}"`, for example `COS10001: 2.3P: Pass Task 2.3 - My Drawing Procedure`. With start dates enabled, titles are prefixed `Start:` and `End:`.
- **Date:** all-day, with `DTSTART` equal to `DTEND` in `YYYYMMDD` form and no time zone. The due-date chain is the task's `local_due_date` when a task record exists, then the target-grade-specific date for a flexible-date unit, then the task definition's `target_date`. Start events use the analogous `local_start_date`, target-grade-specific start date, and task definition `start_date` chain.
- **UID:** `E-{taskDefinitionId}` for the end event and `S-{taskDefinitionId}` for the start event. These are keyed on the task definition, so the same task shares a UID across students, which is what lets a client update the event in place on refresh.
- **Status:** `CONFIRMED`.
- **Reminder:** if the student has set a reminder, each event carries a display alarm that triggers the configured time before the event.
- **Custom properties:** `X-DOUBTFIRE-UNIT` (unit id) and `X-DOUBTFIRE-TASK` (task definition id).

The feed does not set a description, URL, or location on events, and it does not exclude completed tasks; every applicable task definition appears regardless of submission state.

## Calendar-client verification status

The source analysis above has not yet been confirmed in a live calendar client. To complete that evidence:

1. Subscribe as a seeded student and record the client, client version, and test date.
2. Confirm the event titles and all-day dates against the generated feed.
3. Exclude a unit through the modal, refresh the subscription, and record whether its events disappear.

Replace this section with the actual observations before claiming client verification is complete.

## Takeaway

Source inspection shows that the feed covers a student's current units, filtered by target grade and by any units they exclude, as all-day events with stable UIDs and optional reminders and start dates. Its limits are narrow and specific: it always uses the saved target grade rather than a chosen one, and it includes completed tasks. Those two points are the subject of CAL-D02.
