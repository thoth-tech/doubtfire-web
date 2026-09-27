# Unit Hub: announcements and teaching sessions

Unit Hub gives students a single place to find announcements, HelpHubs, lectures, seminars and workshops for their active units. It is available at `/unit-hub`, through the home-page card and in the account menu. It uses the same responsive Angular application on a phone, tablet, desktop and installed OnTrack PWA.

## Normal use

The normal version reads the signed-in user's authorised `/api/unit_hub` response. A student enrolled in SIT111 does not receive SIT102 content. The unit selector only narrows the units returned by the server. A direct link such as `/unit-hub?unit=111` cannot add access to a unit. No content is fabricated when loading fails; the page shows a retry action.

The feed displays published, unexpired announcements and a bounded window of published session occurrences. The page shows the server's window end and warns when the announcement list is truncated. Content is plain text. Original-post links and meeting links open in a separate tab and must use HTTPS. A Teams meeting can still require the student's university sign-in.

Click anywhere on an announcement or session card to open its full details, including the text, dates and blank space. Original-post, Join and calendar actions remain separate controls. Keyboard users can activate the title or **Read full announcement** / **View full details** button; the title's focus indicator outlines the whole card. The dialog opens only records in the current authorised feed and clears its selected content when the route, unit, feed or demo mode changes. It supports keyboard focus, Escape and a visible close button. It does not create a public sharing URL.

## Study essentials

Unit Hub includes public university entry points under **Study essentials**. The home-page card links to Unit Hub. This fork explicitly selects `'deakin'` in `src/app/study-essentials/study-essentials.config.ts`, shared by development, production and the demo. Operators at another institution should set `studyEssentialsProfile` to `''` before building to hide the panel, or supply a reviewed profile. Institution membership is never inferred from an email address, unit code or product name.

The panel links to DeakinSync, CloudDeakin, StudentConnect, timetable guidance, the library and Student Central. Each destination handles its own sign-in and permissions. The links append no account, enrolment or course data. Unit-specific meeting and course links remain in the scoped unit content. See the [Study essentials handover](../src/app/study-essentials/README.md) for the reviewed destinations and configuration.

## Publishing content

A staff member with the unit's `can_manage` permission sees **Manage updates**. Choose the unit, then **New announcement** or **New session**. Leave **Publish to this unit** unchecked to save a draft. Staff can edit drafts and published records, remove announcements, and cancel sessions.

For a session, enter the local start and end times and the IANA time zone, such as `Australia/Melbourne`. Weekly sessions keep the specified local time across daylight saving changes. Choose a final repeat date within six months. Create a separate weekly schedule for each weekday: a Thursday and Friday HelpHub needs two schedules. Editing or cancelling a repeating record affects the entire series. A cancelled session remains visible with its joining and calendar-copy actions removed, so students can see the cancellation.

Content can be published in OnTrack by the teaching team or imported through the companion API's optional Microsoft Teams announcement synchronisation. The university administrator must configure tenant-approved Microsoft Graph access and explicitly map each unit offering to its channel. Microsoft SSO alone does not enable this connection; students do not connect a separate personal account. It is off by default.

When a unit's connection is configured, the management page explains that posts appear after successful updates. “Configured” describes the presence of settings, not proof of working tenant permissions or a successful import. Imported announcements are labelled **From Teams**, are read-only in OnTrack, and provide **Manage in Teams** through their original-post link. Staff should change them at their source. No timetable is inferred from announcement text. Session schedules remain staff-maintained in OnTrack.

## Make a Teams meeting

Assigned teaching staff can prepare a meeting below the session editor or from a session detail view. Enter the session title, dates and time zone, then use **Open Teams draft**. The draft carries the subject, description, resolved start/end instants and any optional attendee sign-in email addresses. The composer has a separate details field, so shortening an invitation leaves the unsaved OnTrack session intact. It does not automatically copy an existing joining or source URL into a new invitation.

Opening the draft sends nothing. Review the invitation and press **Send** in Teams. Copy the newly created meeting's join URL back into the OnTrack session, then save/publish it. OnTrack does not obtain the new URL automatically. This flow does not require the optional Graph announcement connection; Microsoft may ask for a Teams sign-in. It follows Microsoft's [documented meeting-draft integration](https://learn.microsoft.com/en-us/power-apps/teams/integrate-calls-and-meetings).

One occurrence is opened. For a weekly session, set the repeat pattern and final date in Teams before sending, and keep them aligned with OnTrack. Location is included in the description. The helper uses explicit UTC instants and bounds the URL to 8,000 characters and the local attendee list to 20 unique addresses. If the draft is too long, shorten its details or add more attendees in Teams; content is never silently truncated. The HTTPS link lets Microsoft offer its app or browser. If the scheduling form does not open on a phone, use a desktop browser or copy the displayed details into Teams. No invitation is sent by the test suite.

## Calendar choices

- **Add to Google Calendar** opens a draft for one occurrence. The user chooses whether to save it.
- **Download .ics** creates a copy of one occurrence for compatible calendar apps.
- **Calendar settings → Include unit HelpHubs, lectures and classes** opts the user into sessions in their existing private OnTrack calendar subscription. It is off by default. Existing unit exclusions also apply to sessions.

One-off Google drafts and imported files do not receive schedule changes. Subscribed calendars receive changes when the calendar provider refreshes the feed; refresh timing is controlled by the provider. In Google Calendar, the **From URL** subscription setup is performed in a desktop browser. Once subscribed, the calendar is available on mobile too. Session times and joining links are shared with the selected calendar provider. Keep the subscription URL private.

## Demonstration

Use a non-production build with demo tools enabled and sign in to the guarded synthetic account in the isolated demo API. After authentication, `DemoScenarioRegistryService` requests `/api/demo/scenario`; only a successful contract makes **Demo controls** available. A build flag alone is insufficient. Ordinary accounts, an unconfigured API and production cannot activate the walkthrough.

Open **Demo controls**, turn **Demo mode on**, then open **Unit Hub**. The switch updates the page without reloading or signing the user out. Its state belongs to the current scenario and signed-in user in the browser tab. Sign-out or an account change clears that state and the hosted meeting links.

Once the guarded walkthrough is enabled, Unit Hub uses its separate browser-only sample of a fictional student enrolled only in SIT111. It shows two announcements, two HelpHubs and a lecture, including their clickable detail views. The raw fixture contains SIT102 records specifically to exercise filtering; these do not appear. The fixture includes no names, account details or copied posts from real students or staff. Its dates are fictional and generated relative to the browser's local date.

Demo mode does not read the Unit Hub API and blocks staff reads and writes. Samples have no joining action unless the presenter explicitly configures a hosted link. In **Demo controls → Use your own HelpHub links**, add a real Teams joining URL for either or both HelpHubs, choose **Save demo links**, then reopen Unit Hub. **Join hosted demo** opens that real meeting with a notice that the sample schedule is fictional. The lecture has no fabricated joining URL.

Hosted links accept only supported HTTPS joining paths on `teams.microsoft.com`. They stay in session storage for the current browser tab, are cleared by **Clear demo links**, sign-out or the end of the tab session, and are never written to the OnTrack API or committed to fixtures. Turning demo mode off hides them while retaining them for another walkthrough in the same tab. Production cannot use the hosted-link store.

Google drafts and .ics downloads require an explicit user action and are labelled **DEMO**. When a host provides a joining link, the calendar copy includes that link with fictional dates and a demo notice. Opening a Google draft shares its chosen details with Google. Without a hosted link, no joining URL is included. Demo .ics filenames and event UIDs have their own namespace. Session-subscription changes remain disabled even when Calendar is opened from the account menu.

The optional **Try the Teams meeting draft** section in Demo controls opens a real Teams invitation draft with a **DEMO** title and fictional details. It sends nothing automatically. Review the example date and attendees before deliberately pressing **Send** in Teams. No actual meeting URLs should appear in committed fixtures, environment examples, public screenshots or handover text.

Turn demo mode off to return to the real authorised endpoint, including in development builds. The combined runtime has no quiet-data mask or HTTP masking interceptor. See the [demo guide](../src/app/demo/README.md) for local setup and removal notes.

Production builds disable demo tools and cannot activate the Unit Hub fixtures. This release supports the installed web app, not a separately implemented native iOS or Android application.

## Frontend and API contract

| Operation                                            | Endpoint                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Published content for the signed-in account          | `GET /api/unit_hub`                                                                                                                   |
| Staff announcements including drafts                 | `GET /api/units/:unit_id/announcements`                                                                                               |
| Create / update / remove announcement                | `POST /api/units/:unit_id/announcements`, `PUT /api/units/:unit_id/announcements/:id`, `DELETE /api/units/:unit_id/announcements/:id` |
| Staff sessions including drafts and cancelled series | `GET /api/units/:unit_id/sessions`                                                                                                    |
| Create / update / cancel session                     | `POST /api/units/:unit_id/sessions`, `PUT /api/units/:unit_id/sessions/:id`, `DELETE /api/units/:unit_id/sessions/:id`                |
| Read / change subscription preference                | `GET /api/webcal`, `PUT /api/webcal`                                                                                                  |

Writes use `{announcement: {...}}`, `{session: {...}}` and the existing `{webcal: {...}}` wrappers. The calendar preference is `include_learning_sessions` on the wire and `includeLearningSessions` in the Angular model. Feed rows have `unit_id`; `units` provide the id, code, name, `can_manage`, and `teams_sync` (`configured` or `not_configured`). Announcements include `source_provider` (`manual` or `microsoft_teams`) and `managed_externally`; no tenant, client or channel identifiers are exposed. The public session feed contains occurrence dates, whereas staff editing uses the original series dates. See `src/app/unit-hub/unit-hub.models.ts` for the field types.

The [companion API change](https://github.com/ontrack-features-t2-2026/doubtfire-api/pull/160) must be deployed and migrated before this frontend. The API is the authority for authentication, enrolment, role checks, draft visibility and unit access. The client adds defence in depth by removing rows outside the returned unit list, rejecting unsafe links, and cancelling obsolete subscriptions when the route, unit or demo mode changes. The service keeps no shared content cache. Authenticated content is not added to the service worker's data cache.

Calendar exports use explicit UTC instants. Local-time entry rejects daylight-saving gaps and repeated times, preventing silent schedule movement. ICS text is escaped and folded at UTF-8 byte boundaries to prevent content from injecting calendar properties.

## Verification

Release checks include Angular template/type checking, the production build and deployment configuration verification. Targeted Vitest suites cover enrolled-unit filtering, no fallback data on failure, demo/live isolation, blocked demo writes, cancellation of in-flight operations, staff wrappers, route reachability, plain-text detail views and clearing stale dialogs. Calendar checks cover time-zone conversion, safe links, Google encoding, ICS injection/folding and separate demo event identities. Further checks cover imported-post ownership, Teams draft parameter encoding and form preservation, hosted-link validation and sign-out clearing, and the explicit Study essentials profile. Tests inspect generated links without joining or sending a real meeting.

Run the relevant checks:

```sh
npm run typecheck
npm run lint
npm run test:ci -- --include='src/app/unit-hub/**/*.spec.ts' --include='src/app/study-essentials/**/*.spec.ts' --include='src/app/common/modals/calendar-modal/calendar-modal.component.spec.ts' --include='src/app/demo/**/*.spec.ts' --include='src/app/common/header/header.component.spec.ts' --include='src/app/common/guards/spec/role-whitelist.guard.spec.ts'
npm run build -- --configuration production
```

On this macOS validation host, the native Angular disk-cache addon aborted during local production builds. `CI=1` disables that cache and avoids the native failure without changing application or production settings. Font inlining also needs network access to Google Fonts. Use Node 22.23.2 with `CI=1 NG_BUILD_MAX_WORKERS=2 NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=128"` if the same host issue occurs.
