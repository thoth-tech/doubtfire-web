# CAL-D02: Per-unit and grade filtering on the live WebCal feed

Investigation only. This documents what the live WebCal feed can and cannot filter today, and what it would take to add finer filtering, so a decision can be made before any feature work.

## What the feed already filters

The premise that a student must "subscribe to everything or nothing" is not accurate. Two filters are already applied when the feed is generated.

**Per-unit exclusion.** A student can exclude whole units from their feed. This is backed by the `WebcalUnitExclusion` model (`doubtfire-api/app/models/webcal_unit_exclusion.rb`), a join between a `Webcal` and a `Unit`. The task-definition query in `Webcal#task_definitions` (`webcal.rb`) excludes any unit whose id is in the student's exclusions:

```ruby
.where.not(units: { id: WebcalUnitExclusion.where(webcal_id: id).select(:unit_id) })
```

This is already editable from the front end. The Web calendar modal shows the student's units as removable chips (`calendar-modal.component`), and toggling a chip adds or removes a `WebcalUnitExclusion`. The real application screenshots below supplement the [labelled placement mockup](calendar/calendar-controls.svg).

**Grade.** The same query only includes task definitions at or below the student's target grade:

```ruby
.where('task_definitions.target_grade <= projects.target_grade')
```

So the feed is already limited to the tasks the student needs for their saved target grade, not every task in the unit.

## What the feed cannot filter today

- **An independent grade override or HD-only subscription.** The grade filter uses `projects.target_grade`, the student's saved target for each unit, and includes all grades at or below it. Choosing a saved target of High Distinction still includes lower-grade tasks; it cannot produce an HD-only feed.
- **Per-request filtering via the URL.** The public endpoint (`doubtfire-api/app/api/webcal_public_api.rb`) is `GET /webcal/:guid` and takes only the guid. It looks the webcal up and serves `webcal.to_ical.to_ical` with no query parameters, so a calendar client cannot ask for a filtered variant of the feed.
- **Excluding completed or submitted tasks.** The feed iterates every applicable task definition regardless of the student's submission state, so completed tasks stay in the feed.

## What finer filtering would take

- **Grade selection independent of target grade.** The grade filter is a single clause in `Webcal#task_definitions`, so parameterising it is the small part. The larger part is deciding where the selected grade lives: either a new query parameter threaded from `webcal_public_api.rb` into `to_ical`/`task_definitions`, or a stored per-webcal grade override on the `Webcal` model, plus a control in the modal to set it. A stored setting is more consistent with how unit exclusions already work.
- **Exclude completed tasks.** This needs the feed to consider each task's submission state, which means loading the student's `Task` records (the feed already loads them for date resolution in `to_ical`) and skipping the submitted/final states selected by the product policy. The unit download now treats Redo and Fix and resubmit as outstanding, while submitted states awaiting assessment or discussion are excluded. Reuse that definition if extending the feed so the controls agree. This is a change inside `to_ical`, plus a per-webcal toggle if it should be optional.
- **Per-request variants.** Supporting URL parameters on the public endpoint would let a client hold several filtered subscriptions from one webcal, but it widens the public surface and is not needed for the two cases above. A stored per-webcal setting is the lower-risk route.

## Actual settings screenshots — 21 September 2026

These captures use the [synthetic fixture](calendar/evidence-20260921/environment.md), with development demo masking disabled. They show the current implementation, not a historical before-state. The capture area excludes the subscription URL.

![Included units in the real Web calendar settings](calendar/evidence-20260921/webcal-included-unit.png)

![CAL101 excluded using its removal button](calendar/evidence-20260921/webcal-excluded-unit.png)

CAL101 was restored using **Add unit** after the capture. This supplies the screenshot requested by the duplicate CAL-D02 tracker entry. The separate calendar-client refresh check remains under [CAL-D00](CAL-D00-webcal-feed-test.md).

## Assessment

Unit filtering is already complete. Grade filtering exists but is tied to the saved target grade. The realistic next step, if the team wants it, is a per-webcal grade override and an optional "exclude completed" toggle, both stored on the `Webcal` and exposed in the existing modal, reusing the query that already filters by grade. This is a moderate change confined to `webcal.rb`, the `Webcal` model and settings, and the modal. It should be scoped as its own ticket and confirmed with the feature owner before any build, since it changes a live feed other students depend on.

## Sources

- `doubtfire-api/app/models/webcal.rb` (task_definitions scope, to_ical)
- `doubtfire-api/app/models/webcal_unit_exclusion.rb`
- `doubtfire-api/app/api/webcal_public_api.rb`
- `doubtfire-web/src/app/common/modals/calendar-modal/calendar-modal.component.ts` (unit exclusion chips)

## Scope check on 20 September 2026

Rechecked the model, exclusions and public/settings APIs at API `bb360dfa626f30e22c1382e20ef43c06ce6b38fa`. The unit download already supports local grade/range/submission filters; it does not need a database migration or new public endpoint. No feed-filter behavior is changed by the calendar completion PR. Optional learning-session events also respect unit exclusions, and should remain independent of task grade/submission filters.
