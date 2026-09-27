# Layout migration catalogue (MG-04)

## Current status — 21 September 2026

Rechecked against merged web `11.0.x` at
`283b493367681d1abab23e5fe7c633ba3a57e5c2`: **zero Flex Layout directive
occurrences, zero `FlexLayoutModule`/`MediaObserver` imports, and no
`ng-flex-layout` dependency**. Commit `0caa10617` completed the teardown on
20 September. There are no remaining templates to convert for this inventory.

The following audit is retained at its original source revision so its counts
remain reproducible. Its conversion order and live-import warnings describe
that historical revision, not work still required on the current branch.

## Historical inventory — 20 September 2026

Verified on 20 September 2026 against web `11.0.x` at `d16f6201caff78082e5e83c540320dbee5871404`.
This is a source inventory, not measured student usage. The workbook's August counts
were already historical: **10 occurrences across 2 templates** remained at this SHA.
Ranking uses route frequency and task relevance, not attribute counts or invented analytics.

| Priority | Template                                                                               | fx occurrences | Rationale                                               |
| -------- | -------------------------------------------------------------------------------------- | -------------: | ------------------------------------------------------- |
| 1        | `src/app/projects/states/dashboard/project-dashboard/project-dashboard.component.html` |              9 | Student project dashboard: a frequent task entry point. |
| 2        | `src/app/welcome/welcome.component.html`                                               |              1 | Welcome screen: primarily first entry.                  |

The recommended order at this revision was project dashboard first, welcome second.
There was no third candidate. Both conversions have since been completed.

## TypeScript and package wiring

- `src/app/doubtfire-angular.module.ts` (production).

Only the main module still imports `FlexLayoutModule`, which remains in its `imports`
array and supplies the two templates. It is live, so do not remove the dependency yet.
No production or spec `MediaObserver` imports remain at this revision. Earlier audits
reported four production consumers and three specs; those have been migrated.
`MediaObserver` would require Angular CDK `BreakpointObserver`/application logic, not
a direct Tailwind class substitution, if encountered on an older branch.

## Attribute mapping

`fxLayoutAlign` is **main axis first, cross axis second**. For a row,
`fxLayoutAlign="center start"` maps to `justify-center items-start`, not the reverse.

| Directive       | Current occurrences | Replacement / exception                                                                                      |
| --------------- | ------------------: | ------------------------------------------------------------------------------------------------------------ |
| `fxLayout`      |                   2 | `flex flex-row` or `flex flex-col`; preserve breakpoint overrides.                                           |
| `fxFlex`        |                   3 | Per-value decision: `flex-1`, `grow`, `basis-*`, or explicit flex-basis. Do not map every value to `w-full`. |
| `fxLayoutAlign` |                   1 | Map main-axis value to `justify-*`, cross-axis value to `items-*`.                                           |
| `fxFlexFill`    |                   0 | `w-full h-full` with appropriate flex growth after checking the parent.                                      |
| `fxFlexAlign`   |                   0 | `self-*`.                                                                                                    |
| `fxFill`        |                   2 | `w-full h-full`; verify parent dimensions.                                                                   |
| `fxShow`        |                   1 | Conditional visibility / responsive display utilities; expressions need application state.                   |
| `fxHide`        |                   1 | `hidden` plus intended breakpoint display; expressions need application state.                               |

## Bootstrap and Material leftovers

No Bootstrap package is installed. These names are not evidence that Bootstrap still
runs; check component styles before replacing a custom class that happens to share a name.

| File at the audited revision                                                                                                | Status                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/common/pdf-viewer-panel/pdf-viewer-panel.component.html`                                                           | Live Angular template with old class names; replace deliberately with Material/utilities. |
| `src/app/projects/states/dashboard/directives/student-task-list/student-task-list.tpl.html`                                 | Dead legacy source; see the legacy map.                                                   |
| `src/app/projects/states/dashboard/directives/task-dashboard/directives/task-submission-card/task-submission-card.tpl.html` | Dead legacy source; see the legacy map.                                                   |
| `src/app/projects/states/dashboard/directives/task-dashboard/task-dashboard.tpl.html`                                       | Dead legacy source; see the legacy map.                                                   |
| `src/app/tasks/task-comment-composer/task-comment-composer.component.html`                                                  | Live Angular template with old class names; replace deliberately with Material/utilities. |
| `src/app/units/modals/unit-student-enrolment-modal/unit-student-enrolment-modal.component.html`                             | Live Angular template with old class names; replace deliberately with Material/utilities. |
| `src/app/units/states/analytics/analytics.tpl.html`                                                                         | Dead legacy source; see the legacy map.                                                   |
| `src/app/visualisations/progress-burndown-chart.coffee`                                                                     | Dead legacy source; see the legacy map.                                                   |

Material legacy appearance remains at `src/app/units/states/edit/directives/unit-staff-editor/unit-staff-editor.component.html:21`. This is the older button-toggle appearance, not the removed form-field appearance.

## Reproduce the counts

Current status (the first two commands produce no matches):

```sh
git grep -nE 'fx[A-Z][A-Za-z]*' 283b49336 -- 'src/**/*.html'
git grep -nE 'ng-flex-layout|FlexLayoutModule|MediaObserver' 283b49336 -- package.json 'src/**/*.ts'
```

Historical inventory:

```sh
git grep -nE 'fx[A-Z][A-Za-z]*' d16f6201c -- '*.html'
git grep -n "from 'ng-flex-layout'" d16f6201c -- '*.ts'
git grep -nE 'btn btn-|col-sm-|form-group|panel panel-|input-group|glyphicon' d16f6201c -- src
```

Count regex **matches**, not matching lines, when updating this table. Follow the
[CSS style guide](../css-style-guide.md) and [theme contract](../theme/THEME-CONTRACT.md).
