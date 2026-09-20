# CAL-D01: WebCal entry point audit

Recon and documentation only. No feature code or component changes were made for this
ticket. All findings below are from reading the actual frontend source on
`feature/CAL-D01-webcal-entry-point-audit` (branched off `feature/calendar-integration`),
quoting real file paths and real code.

## What WebCal is

WebCal is an existing (since 2020, per project history) feed-subscription feature. A
student enables it, gets a personal `.ics` feed URL, and can point any external calendar
app (Google Calendar, Apple Calendar, Outlook) at that URL to subscribe. The subscribed
calendar then pulls task due dates on a refresh interval. This is different from a one-off
"add this single event" action (which is what CAL-F01 builds): WebCal is a standing
subscription to a feed, not a per-task button.

The entire frontend surface for WebCal is two things:

- `src/app/api/services/webcal.service.ts`, a thin CRUD service for the user's webcal
  settings (enabled, guid, includeStartDates, reminder, unitExclusions). It does not
  render anything itself.
- `src/app/common/modals/calendar-modal/calendar-modal.component.ts` (and its
  `.component.html`), a Material dialog that is the actual settings UI: an enable toggle,
  the `.ics` URL with a copy-to-clipboard button, reminder configuration, and per-unit
  exclusion controls. Confirmed by reading the component directly, every mutation in it
  (`this.webcalService.update(...)`, `this.webcalService.get({})`) goes through
  `WebcalService`, and the dialog's own title, read from
  `calendar-modal.component.html:4`, is:

  ```html
  <h2 mat-dialog-title>Web calendar</h2>
  ```

  Note this title says "Web calendar", not "Calendar", a small labeling inconsistency
  from the entry points that lead to it, covered below.

The modal is opened exclusively through `CalendarModalService`
(`src/app/common/modals/calendar-modal/calendar-modal.service.ts`):

```ts
public show(_task?: Task) {
  this.dialog.open(CalendarModalComponent, {
    height: 'h-min',
    maxHeight: '90vh',
    width: '800px',
    maxWidth: '95vw',
  });
}
```

The `_task` parameter is unused (underscore-prefixed, never read inside `show`), and both
real call sites pass `null`. This confirms the modal always shows the same
account-level webcal settings, it does not open scoped to a specific task in any way,
regardless of where it was triggered from.

## Entry point 1: header avatar menu, "Calendar"

**File:** `src/app/common/header/header.component.html`, lines 91-102, wired to
`src/app/common/header/header.component.ts`, `openCalendar()` at lines 243-245.

```html
<button mat-button [matMenuTriggerFor]="menu2">
  <user-icon [size]="32" [user]="currentUser"></user-icon>
</button>
<mat-menu #menu2="matMenu">
  <button mat-menu-item routerLink="/edit_profile">
    <mat-icon aria-label="Edit profile" matListItemIcon>person</mat-icon>
    My Profile
  </button>
  <button mat-menu-item (click)="openCalendar()">
    <mat-icon aria-label="Edit calendar" matListItemIcon>calendar_month</mat-icon>
    Calendar
  </button>
  ...
</mat-menu>
```

- **Visible label:** "Calendar", with a `calendar_month` Material icon.
- **UI hierarchy:** top-right user avatar icon in the global header (always present,
  `<button mat-button [matMenuTriggerFor]="menu2">` has no role or breakpoint condition
  around it), opens a dropdown menu containing My Profile, Calendar, About, Sign Out, in
  that order.
- **Header presence:** the header itself (`showHeader`) defaults to `true` and is only
  hidden on sign-in, welcome/onboarding, the SCORM player, and during auth transitions
  (confirmed by grepping every `.hideHeader()` call site: `authentication.service.ts`,
  `welcome.component.ts`, `sign-in.component.ts`, `scorm-player.component.ts`). It is
  present on the task dashboard route.

## Entry point 2: Task Planner page, "Open calendar" button

**File:** `src/app/projects/states/plan/project-plan.component.html`, lines 36-41, wired
to `project-plan.component.ts`, `openCalendar()` at lines 80-82.

```html
<p>
  Subscribe to your unit calendar to be reminded about your due dates.
  <button color="primary" mat-stroked-button type="button" (click)="openCalendar()">
    Open calendar
  </button>
</p>
```

- **Visible label:** "Open calendar", plain text on a `mat-stroked-button`, with an
  explanatory sentence directly above it ("Subscribe to your unit calendar to be reminded
  about your due dates."). No icon on this specific button.
- **UI hierarchy:** this button sits directly on the Task Planner page
  (`/projects/:projectId/plan`), visible immediately on page load, not behind any further
  menu on that page. Reaching the page itself requires going through the breadcrumb
  dropdown in the header, see the click path below.
- **The page itself is reached via a "Task Planner" link that does not say "calendar" in
  its own label**, `src/app/common/header/task-dropdown/task-dropdown.component.html`,
  lines 59-62:

  ```html
  <button mat-menu-item [routerLink]="['/projects', currentProject.id, 'plan']">
    <mat-icon aria-label="Plan icon" fontIcon="calendar_month"></mat-icon>
    Task Planner
  </button>
  ```

  This reuses the same `calendar_month` icon glyph as entry point 1's "Calendar" menu
  item, but the visible text label here is "Task Planner", not "Calendar". Two different
  strings, one icon, worth flagging as a real discoverability inconsistency: the icon that
  correctly signals "calendar" on one menu item is reused on a different item whose label
  gives no calendar hint at all.

## Click paths from `/projects/2/dashboard/2.3P`

**Entry point 1 (header avatar, "Calendar"), 2 clicks:**

1. Click the user avatar icon in the top-right of the header (always visible, the
   `<user-icon>` inside `[matMenuTriggerFor]="menu2"`).
2. In the dropdown that opens, click "Calendar" (second item, `calendar_month` icon,
   between "My Profile" and "About").

This opens the "Web calendar" dialog directly. 2 clicks, 0 page navigations.

**Entry point 2 (Task Planner, "Open calendar"), 3 clicks:**

1. Click the breadcrumb dropdown trigger in the header. At `/projects/2/dashboard/2.3P`
   this button's visible text is derived from the matched route's `data.task` value. The
   `dashboard/:taskAbbreviation` route
   (`src/app/app.routes.ts:244-247`) has `data: {task: 'Dashboard'}`, and
   `'Dashboard'` has no override in `task-dropdown.component.ts`'s `taskToShortName` map,
   so the button reads literally **"Dashboard"** with a dropdown arrow icon next to it.
   This is a guess about visual rendering specifically, confirmed from the data binding
   and route data, not from an actual screenshot yet, screenshots are the placeholder
   section below.
2. In the dropdown, click "Task Planner" (third item, after Dashboard and a divider,
   `calendar_month` icon, see entry point 2 above).
3. On the Task Planner page that loads, click "Open calendar" (visible immediately, no
   further menu).

3 clicks, 1 page navigation, to reach the same dialog as entry point 1.

## Discoverability assessment

Answering the "nobody can find it" claim directly, with evidence rather than assertion:

- **Neither entry point is visible without opening a menu first.** Entry point 1 requires
  opening the avatar dropdown. Entry point 2 requires opening the breadcrumb dropdown,
  then navigating to a whole separate page, where the button is visible without a further
  menu, but getting there in the first place is still menu-gated. There is no persistent,
  always-on-screen calendar affordance anywhere in the task dashboard itself, confirmed by
  the earlier CAL-F01 recon of `task-description-card.component.html`'s
  `mat-card-actions` block, which had no calendar link before CAL-F01 added one for a
  different purpose (a single add-to-Google-Calendar action, not WebCal).
- **Only one of the two visible labels says "calendar."** Entry point 1's menu item is
  literally labeled "Calendar". Entry point 2's *menu item* is labeled "Task Planner", the
  word "calendar" only appears once you have already navigated to that page and are
  reading the "Open calendar" button and the sentence above it. A student scanning menu
  labels for the word "calendar" would find entry point 1 but not entry point 2's link.
- **The icon is reused inconsistently.** `calendar_month` appears on both entry point 1's
  "Calendar" item and entry point 2's "Task Planner" item. Same glyph, one matches its
  label, one does not. This undercuts the icon as a reliable visual cue across the app.
- **The modal's own title ("Web calendar") differs from both entry points' labels**
  ("Calendar", "Open calendar"). Three different strings for the same feature across the
  full path, which is a small but real naming-consistency problem on top of the
  discoverability one.

Net: the "nobody can find it" claim holds up. The clearest path (entry point 1) is still
2 clicks deep with no persistent visual presence on the page a student spends the most
time on (the task dashboard), and the second path is both deeper and more ambiguously
labeled.

## Role differences

Checked both entry points and their surrounding menus directly for role gating:

- **Entry point 1 (header avatar menu) has no role gating.** The trigger button
  (`header.component.html:91-93`) and every item inside `#menu2` (My Profile, Calendar,
  About, Sign Out) are unconditional, no `@if` around any of them. This is different from
  the separate admin-only menu in the same header (`#menu`, gated to
  `currentUser.role === 'Admin' || currentUser.role === 'Convenor'` at line 60), which
  confirms role gating exists elsewhere in this file and was deliberately not applied to
  the Calendar item, this looks like an intentional "everyone gets this" choice, not an
  oversight, though that is inferred from the surrounding code pattern, not from a comment
  stating it explicitly.
- **Entry point 2 depends on view context, not role directly.** The "Task Planner" item
  in `task-dropdown.component.html` sits inside
  `@if (currentProject !== null && currentView === 'PROJECT')` (line 54), the branch used
  whenever anyone, student or staff, is viewing a specific project. Staff viewing a
  student's project (`viewingOtherStudentProject`, defined in
  `project-plan.component.ts:84-89`) still see the "Open calendar" button, it is not
  wrapped in any conditional in the template. Worth flagging as a real behavioural quirk:
  if a tutor opens a student's Task Planner page and clicks "Open calendar", the dialog
  shows the **tutor's own** webcal settings (`webcalService.get({})` always fetches the
  current authenticated user's webcal), not the student's. Nothing in the UI clarifies
  this, a tutor could plausibly believe they are looking at or subscribing to the
  student's calendar. This is a real, evidenced UX gap, not a guess, from directly
  reading `webcal.service.ts`'s `get` call and the absence of any `projectId`/`userId`
  parameter being passed.
- **Staff viewing at UNIT level (not inside a specific project) see no calendar-related
  entry point via entry point 2 at all.** The `@if (unitRole && currentView === 'UNIT')`
  branch in the same file (line 77 onward, the Inbox/Explorer/Moderation/Students/etc.
  menu for staff) has no calendar-related item anywhere in it. They still retain entry
  point 1 (header avatar menu), which is present regardless of view context or role.

Net: no role sees an *additional* WebCal entry point the others lack. If anything, staff
in unit-level views temporarily lose access to entry point 2 until they navigate into a
specific project, while retaining entry point 1 throughout.

## Dead or unreachable entry points

None found. Searched for every reference to `CalendarModalService`/`calendarModal.show`
across the frontend (`grep` across `src/app`) and found exactly four files: the service
definition, the two real call sites documented above
(`header.component.ts`, `project-plan.component.ts`), and `header.component.spec.ts` (a
test, not a UI entry point). No commented-out calendar or webcal markup was found anywhere
in the templates searched. No feature flag or `isFeatureEnabled`-style condition gates
either button. Both entry points are live and reachable exactly as described above.

One adjacent false positive worth ruling out explicitly, since it shares a name: the
`angular-calendar` npm package (imported as `CalendarEvent` from `'angular-calendar'`) is
also used by `src/app/units/states/analytics/directives/analytics-tutor-times.component.ts`,
for a tutor session-times week-view widget. This is a completely unrelated feature that
happens to use the same third-party calendar-rendering library. It is not a WebCal entry
point and should not be confused with one in any follow-up work.

## Recommendation for CAL-F04

CAL-F04 should not rely on either existing entry point as "sufficient" prior art, both are
menu-gated and inconsistently labeled, which is the root cause this audit was asked to
evidence. A visible entry point on the task dashboard itself, the page a student actually
spends time on, is the right target. The `task-description-card.component.html`
`mat-card-actions` row (already used by CAL-F01 for a related but distinct
add-single-event action) is a reasonable candidate location to consider, since a student
is already looking at that card when deciding whether they want ongoing reminders, not
just a one-off addition. This is a recommendation, not a decision, the actual placement
call belongs to whoever scopes CAL-F04, and should confirm with the team whether a WebCal
entry point and CAL-F01's per-task button are meant to coexist in the same card or be
kept visually distinct, since they are different mechanisms (standing subscription vs.
one-off event) that could otherwise read as duplicates to a student.

## Screenshots

These are on the PR
