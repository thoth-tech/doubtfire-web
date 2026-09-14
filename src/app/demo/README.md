# Centralised local demo mode

This folder owns the controls and shared state for the combined local walkthrough. Unit Hub's
sample content is in `src/app/unit-hub/unit-hub-demo.fixtures.ts`. Demo tools are available only when
`environment.enableDemoTools` is true and
`environment.production` is false. They start off and persist only for the current browser tab.

When demo mode is off in local development, the HTTP mask keeps `DEMO20007` (or one fallback
project), hides notification rows/counts, and the task PPI service returns a labelled masked state.
When it is on, those API-backed surfaces pass through unchanged. The unit-summary percentage,
burndown curve and push preview use fabricated presentation values. Unit Hub has its own explicit
demo fixtures: with the switch off, it always reads the signed-in account's authorised live API
content, including in a development build.

The push preview is visual only. It must never inject `SwPush`, request `Notification` permission,
or call `/push_subscriptions`.

## Unit Hub walkthrough

Enable **Demo mode** in **Demo controls**, then open **Unit Hub**. The fictional student is enrolled
in SIT111. The sample contains announcements, two HelpHubs and a lecture. SIT102 rows deliberately
exist in the raw fixture to check that unrelated unit content is excluded from the displayed feed.
Click an announcement title or **Read full announcement** to read the complete post. Click a session
title or **View full details** for its description, time, joining and calendar choices. The detail
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
6. Remove the `DemoModeStore.reset()` sign-out hook from `authentication.service.ts`.
7. Remove demo gating/imports from the PPI indicator, progress dashboard, and burndown chart.
8. Either delete the demo-only unit summary and peer-median UI or replace them with authorised live
   API adapters before retaining those surfaces.
9. Remove Unit Hub's demo fixture branch and hosted-link store dependency from `UnitHubService`,
   keeping its authorised API path. Remove demo notices/actions from Unit Hub, its details dialog
   and calendar exports. Remove the demo fixture file and demo-only session marker once unused.
   Retain the production Teams meeting composer and the configured Study essentials panel.
