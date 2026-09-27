# Guarded local demo walkthrough

`DemoScenarioRegistryService` controls eligibility for the combined local walkthrough and supplies its seeded runtime adapters.
It loads `GET /api/demo/scenario` after authentication and keeps the returned contract in its own
in-memory subject. It does not write units, projects, tasks, notifications, groups, or dynamic IDs
into any normal entity cache.

Two independent guards are required: the build must set `environment.enableDemoTools` in a
non-production build, and the API contract must succeed for the guarded synthetic account. An
ordinary development API, another account, or production returns a generic 404, leaving the tools
unavailable.

Demo OFF is a true pass-through. There is no HTTP masking interceptor and no PPI substitution.
Demo ON enables the seeded feature adapters from the contract and the explicitly isolated Unit Hub sample described below. The enabled
bit is stored in `sessionStorage` under both the scenario ID and authenticated user ID, is reset on
sign out/account change, and never travels to the API. Toggling does not reload the application or
mutate server data.

The canonical semantics and seed live in the API's
`lib/demo_data/mobile_feedback_scenario.rb`. The seeded task, notification, group and peer-progress adapters use that contract. Unit Hub separately uses browser-only sample announcements and schedules after the same guards pass; these samples never enter the runtime registry or normal entity caches.

## Unit Hub walkthrough

First sign in to the guarded synthetic account and wait for the scenario contract to load. Enable **Demo mode** in **Demo controls**, then open **Unit Hub**. The switch applies immediately without a reload or another sign-in. The fictional student is enrolled
in SIT111. The sample contains announcements, two HelpHubs and a lecture. SIT102 rows deliberately
exist in the raw fixture to check that unrelated unit content is excluded from the displayed feed.
Click anywhere on an announcement or session card, including its blank space, for full details.
Separate Join, original-source and calendar controls keep their own actions. The detail
dialog closes and clears its selected content when the unit, route or demo mode changes.

The sample dates are generated relative to the local browser date and are not an official timetable.
Staff editing, live API writes and calendar subscriptions remain disabled in the Unit Hub demo.
Google Calendar drafts and downloaded ICS copies are explicitly labelled **DEMO**. They are created
only when the user chooses and do not receive later schedule changes.

### Optional hosted HelpHub links

In **Demo controls → Use your own HelpHub links**, paste a Teams joining link for either or both
HelpHubs, then choose **Save demo links**. Open Unit Hub again to see **Join hosted demo**. The lecture
keeps its sample description and calendar actions without a fabricated joining destination.

Only supported HTTPS joining paths on `teams.microsoft.com` are accepted. The host-provided links
are stored in `sessionStorage` for the current browser tab. They are never sent to OnTrack's API,
seeded into production or committed to the repository. **Clear demo links**, signing out or ending
the browser tab session removes them. Turning demo mode off hides the hosted links but retains them
for another walkthrough in the same tab. Production builds cannot use this store.

A hosted link opens a real meeting supplied by the presenter. Calendar copies include that link
with fictional dates and a clear demo notice. Opening a Google Calendar draft shares its chosen
details with Google. Keep links out of public screenshots, test fixtures and handover documents.
Without a host-provided link, the sample offers no joining action.

### Try the Teams meeting draft

The optional **Try the Teams meeting draft** section opens a real Teams invitation draft with a
**DEMO** title and fictional details. Opening it sends no invitation. Review the example times and
attendees; press **Send** in Teams only if deliberately creating that meeting. Tests inspect the
generated URL without following it or sending anything.

The same composer is available to assigned teaching staff in the normal session editor and session
detail view. It prefills the subject, description, start/end instants and optional university sign-in
email addresses. Draft-only description edits leave the unsaved OnTrack session intact. Teams
creates the actual meeting join URL after the invitation is sent; copy that URL back into the
OnTrack session and save/publish it. An existing joining or source URL is not automatically copied
into a new invitation.

Microsoft documents [the scheduling fields and required time offsets](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-link-workflow).
Repeating schedules must be set in Teams before sending; the link opens one occurrence. Location is
included as description text because the scheduling URL has no location parameter. Details or
attendees that exceed OnTrack's URL bound must be shortened for the draft or added directly in Teams.
The [HTTPS deep-link chooser](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-links)
offers the app or web client. If a phone cannot open the scheduling draft, use a desktop browser or
copy the displayed details into Teams. This does not require the optional Graph announcement sync
connection, and a separate Teams sign-in may be requested by Microsoft.

## Study essentials

Unit Hub, available from the home-page link, shows public university entry points using the explicit
`studyEssentialsProfile` in `src/app/study-essentials/study-essentials.config.ts`. This fork sets
`'deakin'` for development, production and the demo. Other institutions should set it to `''` before
building, or provide their own reviewed profile. The choice is never inferred from a unit code,
email address or product name. See [the Study essentials handover](../study-essentials/README.md).

The panel links to DeakinSync, CloudDeakin, StudentConnect, timetable guidance, the library and
Student Central. Each destination controls its own sign-in. No account, enrolment, course or meeting
details are appended to these public links. Unit-specific content remains in the scoped Unit Hub.

## Removal

1. Remove `DemoToolsModule` from `doubtfire-angular.module.ts` and delete this folder.
2. Remove `/demo-controls` and its imports from `app.routes.ts`.
3. Remove the Demo controls item/store injection from `common/header/header.component.*`.
4. Remove `<f-demo-mode-banner>` from `app.component.html`.
5. Remove `enableDemoTools` from both environment files.
6. Remove the registry load/clear and `DemoModeStore.reset()` sign-out hooks from
   `authentication.service.ts`.
7. Remove demo gating/imports from the progress dashboard, burndown chart, and any later feature
   adapters that consume `DemoScenarioRegistryService`.
8. Either delete the demo-only unit summary and peer-median UI or replace them with authorised live
   API adapters before retaining those surfaces.
9. Remove Unit Hub's demo fixture branch and hosted-link store dependency from `UnitHubService`,
   keeping its authorised API path. Remove demo notices/actions from Unit Hub, its details dialog
   and calendar exports. Remove the demo fixture file and demo-only session marker once unused.
   Retain the production Teams meeting composer and the configured Study essentials panel.
