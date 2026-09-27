# CAL-DOC01: Using the calendar features

OnTrack offers a few ways to get your task due dates into your own calendar. There are two broad options: a one-off copy (a file or a single event you add now) and a live subscription (a feed that keeps updating as your dates change). Use a one-off copy when you just want the dates as they stand today, and a subscription when you want your calendar to stay in sync.

## Add a single task to Google Calendar

On a task's page, the task card shows an **Add to Google Calendar** button. It opens Google Calendar in a new tab with the event details for that one task's due date already filled in, ready for you to save. This adds one event only, and it does not update if the due date later changes. For a whole unit or for live updates, use the options below.

![Add to Google Calendar in the task description card](calendar/evidence-20260921/ontrack-task-action-row.png)

Actual application screenshot, captured on 21 September 2026 with a synthetic CAL101 task.

## Download a unit's due dates as a file

On a unit's **Progress Dashboard**, the **Plan Your Tasks** card has a **Download .ics** button. It opens a **Download options** dialog, and confirming there downloads an `.ics` calendar file containing the due dates for that unit's tasks, which you can import into Google Calendar, Apple Calendar, Outlook, or any calendar app.

![Download .ics in the Plan Your Tasks card on the Progress Dashboard](calendar/evidence-20260921/ontrack-dashboard.png)

Actual application screenshot with synthetic CAL101 data. The header calendar icon is also visible at the top right.

The dialog has three choices:

- **Grade.** Choose a grade level. It defaults to your current target grade.
- **Up to this grade** or **This grade and above.** Up to this grade is the default and includes only the tasks required up to that grade, so if you are targeting a Credit you will not get the Distinction and High Distinction tasks. This grade and above includes that grade's tasks and every higher grade's instead.
- **Exclude submitted and completed tasks.** On by default. Tasks awaiting feedback, discussion or demonstration, and final-state tasks, are left out. Tasks marked Redo or Fix and resubmit stay in the download because they require another submission. Untick it to include all matching dated tasks.

For HD-only tasks, choose **High Distinction** and **This grade and above**. Choosing **Up to this grade** with High Distinction includes Pass, Credit and Distinction tasks too.

![High Distinction and This grade and above select the single HD task](calendar/evidence-20260921/filter-hd-only.png)

The synthetic unit has one task at each grade. With submitted-task exclusion off, the HD-only selection above downloads one task. The actual downloads for all grades and the exclusion option are retained in the [export evidence](calendar/evidence-20260921/exports/README.md).

The dialog announces how many tasks with valid due dates match your choices. Tasks without a resolvable due date cannot become calendar events. If nothing matches your choices, the dialog says so and its download button stays disabled. Your choices are not saved to your profile and do not change your target grade.

The downloaded file is named after the unit and the options you chose (for example `COS10001-tasks-HD-outstanding.ics`, or `COS10001-tasks-D-and-above-outstanding.ics`), so downloads for different grades or settings do not overwrite each other. Like any downloaded file, it is a snapshot: it does not update if your dates later change.

## Find and open the calendar

A **calendar icon** in the top header opens the Web calendar dialog from anywhere. The same dialog is also reachable from the Task Planner. This is where you subscribe to the live feed or download a copy of it.

## Subscribe to the live feed (WebCal)

In the Web calendar dialog, enable the calendar to generate your personal subscription URL. Unlike a downloaded file, a subscription stays in sync: when a due date changes, your calendar app updates automatically on its next refresh.

- **Choose which units to include.** The dialog lists your units as chips. Remove a unit to leave it out of the feed, and add it back from the menu.
- **Set a reminder.** Optionally have your calendar remind you a set time before each event.
- **Include start dates.** Optionally add each task's start date as well as its due date.
- **Include unit HelpHubs, lectures and classes.** Opt in to published session times and joining links. Your unit exclusions also apply to sessions. This is disabled in demo mode.

The subscription uses the saved target grade for each unit and continues to include submitted/completed tasks. The download dialog's local filters do not alter it. Keep the subscription URL private: anyone with the URL can retrieve its events. Regenerating the URL or disabling the calendar revokes the existing link; clients must subscribe again with the new URL.

To subscribe, copy the URL and add it in your calendar app: in Google Calendar choose Add other calendars then From URL; in Apple Calendar choose File then New Calendar Subscription; in Outlook choose Add calendar then Subscribe from web. Then paste the URL.

## Download a copy of the feed

If you want the current state of your subscription as a one-off file rather than a live link, the Web calendar dialog has a **Download a copy** button (shown when the calendar is enabled). It saves the same events the subscription would deliver, for the units you have included, as an `.ics` file.

## Which should I use?

- A quick single date: **Add to Google Calendar** on the task.
- One unit's dates as they stand today, with grade or outstanding-only filtering: **Download .ics** on the Progress Dashboard.
- A calendar that keeps itself up to date across your units: **subscribe** to the WebCal feed.
- A one-off snapshot of that whole feed: **Download a copy** in the dialog.

## Keyboard use and client support

Open Download .ics with Enter or Space; focus moves to Grade. Use Tab to reach the remaining options, Download and Cancel. Escape dismisses the dialog and returns focus to the opener. The result count is a status message. See [accessibility verification](CAL-A01-accessibility-verification.md) for completed component checks and the manual checks still to record.

See [compatibility evidence](CAL-C01-calendar-compatibility.md) for the four-event fixture and the completed Apple, Google and Outlook import checks. All three showed the intended single all-day dates; the report records how each client displays long Unicode titles and embedded newlines. The separate [live-feed check](CAL-D00-webcal-feed-test.md) verified Apple Calendar subscription updates after manual refresh.
