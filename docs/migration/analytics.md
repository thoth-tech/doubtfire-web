# Unit Statistics charts (MG-11)

Unit Statistics now includes task-status bubbles, target-grade shares and task-completion
box plots alongside the existing CSV exports and tutor-time summary. The shared tutorial
selector switches between the whole unit and one tutorial. Task Status additionally
filters by task; Task Completion can show the selected unit/tutorial or all grade groups.
New routes/sub-states are outside this change.

## Chart library compatibility

Rendering tests uncovered that ngx-charts 20.5 injects Angular's removed
`ComponentFactoryResolver`. The dependency is upgraded to **25.0.2**, whose
[upstream changelog](https://github.com/swimlane/ngx-charts/blob/master/docs/changelog.md)
adds Angular 22 support. Existing burndown, task-status pie and gauge components
have real SVG smoke tests as well as the new chart tests. No tooltip injection
shim or disabled render assertion is used to hide the incompatibility.

## Behaviour retained from the source

- `SummaryTaskStatusScatterComponent` totals the existing
  `TaskStatusStats[taskDefinitionId][tutorialId]` rows by status. The x axis is status,
  the y axis is task, and bubble size is count. Invalid/unknown counts are excluded.
- `TargetGradePieChartComponent` totals rows by grade, uses configured unit grade
  labels and the existing grade palette, and reports `round(count / total * 100)`.
  Empty selections do not divide by zero.
- `TaskCompletionBoxPlotComponent` preserves the API's `min`, `lower`, `median`,
  `upper`, `max` for unit, tutorial and grade groupings. The installed ngx-charts box
  series computes quartiles from its input. Supplying these **five ordered summary
  values** puts its 25th/50th/75th percentile positions exactly at the supplied
  lower/median/upper values. The component spec asserts the rendered ngx-charts
  quartiles and whiskers, rather than only asserting a mapper's output. These are
  summary values, not fabricated student observations.

The API's existing `Unit#_calculate_task_completion_stats` uses the 30% and 80%
array positions for lower/upper, and includes records with completed tasks. The UI
labels them **lower** and **upper**, not newly calculated population quartiles.
Changing the API population/percentile definition would be a separate behavioural change.
The new chart uses ngx-charts' labelled data range instead of the old fixed y domain.

The status and grade endpoints group by tutorial enrolment. Whole-unit sums retain
the old aggregation and may count a student once per stream. The page discloses this;
these charts must not be represented as deduplicated student headcounts. The data
comes from the existing authenticated `/units/:id/stats/task_status_pct`,
`student_target_grade`, and `task_completion_stats` endpoints, all of which enforce
`:download_stats` on the API. No new endpoint or client cache is introduced.

## Resilience and accessibility

Changing units cancels the preceding request and clears old data and filter selection.
Failures leave successful charts available and show a retry action. Loading, failure,
empty and all-zero completion states are explicit. Each chart has a semantic values
table; chart drawing is hidden from screen readers to avoid duplicate/colour-only
information. Filters use labelled Material controls. No student names are added.

## Verification

Run the chart specs through Angular's test builder (Vitest):

```sh
npm test -- --watch=false --include='src/app/visualisations/summary-task-status-scatter/*.spec.ts' --include='src/app/visualisations/target-grade-pie-chart/*.spec.ts' --include='src/app/visualisations/task-completion-box-plot/*.spec.ts' --include='src/app/units/states/analytics/*.spec.ts'
npm run typecheck
npm run build
npm run lint
```

Review with a convenor account: open Unit Statistics, switch tutorials and task,
compare the accessible tables with the endpoint payloads, try grade grouping, then
simulate a failed stats request and use Retry. Check narrow layouts and theme contrast.
A seeded/authenticated API session is required for that final real-data walkthrough;
unit fixtures are not evidence that a production account was exercised.

See the [recorded validation results](validation.md) for the final full-suite run and source revisions.

The [21 September authenticated walkthrough](acceptance-2026-09-21.md) now records
the seeded full-app exercise, actual API payload comparisons, filtering/retry and
settled responsive/theme checks, including the discovered SVG label contrast fix.
