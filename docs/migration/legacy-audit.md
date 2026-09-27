# Legacy source and toolchain audit (MG-06, MG-08, MG-09)

Baseline: web `11.0.x` `d16f6201caff78082e5e83c540320dbee5871404`, inspected 20 September 2026.

## Migration guide: already resolved

`MIGRATION-GUIDE.md` was deleted by `03bc2cdf377ec2a4e07cae668f0511c2d6c6b6fc`
on 15 September 2026. The accurate component instructions now live in
[CONTRIBUTING.md](../../CONTRIBUTING.md). Preserve that deletion; do not recreate the
AngularJS downgrade process. The complete former guide was inspected with
`git show 03bc2cdf3^:MIGRATION-GUIDE.md`.

| Old guide lines          | Reference / advice                                                                                      | Verified state                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 45–47                    | `task-description-card.coffee`, `.tpl.html`, root `.scss`                                               | Replaced by `.component.ts`, `.component.html`, `.component.scss` in the task-description-card directory. |
| 107                      | `src/app/projects/states/dashboard/directives/task-dashboard/directives/directives.coffee`              | Absent.                                                                                                   |
| 110–115                  | `src/app/doubtfire-angular.module.ts`, imports and declarations                                         | Live and still necessary for non-standalone components.                                                   |
| 116–128                  | `src/app/doubtfire-angularjs.module.ts`, `downgradeComponent`, `build/src/.../task-description-card.js` | Absent; AngularJS bootstrapping removed.                                                                  |
| 167, 198–199             | `npm start`, accessibility labels, linting                                                              | Still applicable. Use `npm run lint` to preserve `--max-warnings 0`.                                      |
| 17, 25, 184–188, 201–209 | Bootstrap-to-Material conversion                                                                        | Runtime conversion complete; orphan markup remains in the catalogue.                                      |

For paths, `git cat-file -e <sha>:<path> && echo LIVE || echo DEAD` gives an
explicit result. For short filenames use `git ls-tree -r --name-only <sha>` first.
No `downgradeComponent` remains in `src`. The two Angular module names differ:
`doubtfire-angular.module.ts` **is live**; `doubtfire-angularjs.module.ts` is absent.

## CoffeeScript inventory and resolution

| Baseline path                                               | Lines | Replacement / outcome                                                                    |
| ----------------------------------------------------------- | ----: | ---------------------------------------------------------------------------------------- |
| `src/app/common/filters/filters.coffee`                     |   320 | Eight Angular pipes in `src/app/common/filters/`; remove dead source.                    |
| `src/app/units/states/tasks/definition/definition.coffee`   |    31 | `app.routes.ts` definition routes and `UnitTaskInboxStateComponent`; remove dead source. |
| `src/app/visualisations/progress-burndown-chart.coffee`     |   107 | `ProgressBurndownChartComponent`; remove dead source and root orphan SCSS.               |
| `src/app/visualisations/summary-task-status-scatter.coffee` |    29 | MG-11: replaced by `SummaryTaskStatusScatterComponent`.                                  |
| `src/app/visualisations/target-grade-pie-chart.coffee`      |    48 | MG-11: replaced by `TargetGradePieChartComponent`.                                       |
| `src/app/visualisations/task-completion-box-plot.coffee`    |    66 | MG-11: replaced by `TaskCompletionBoxPlotComponent`.                                     |
| `src/app/visualisations/task-status-pie-chart.coffee`       |    46 | `TaskStatusPieChartComponent`; remove dead source.                                       |
| `src/app/visualisations/visualisations.coffee`              |    61 | Retained-for-reference module; delete after all three replacements are integrated.       |

The filter replacements are `filters.pipe.ts`, `order-by.pipe.ts`,
`task-definition-name.pipe.ts`, `tasks-by-tutor.pipe.ts`, `tasks-for-group-set.pipe.ts`,
`tasks-for-inbox-search.pipe.ts`, `tasks-in-tutorials.pipe.ts`, and
`tasks-of-task-definition.pipe.ts`. They are registered in the main Angular module.
The definition route still selects explorer mode, search options, task-definition mode
and `queryTasksForTaskExplorer` in the Angular inbox component.

The `visualisations.coffee` header explicitly said it was unlinked and retained for
reference. Migration deletions preserve the history; the new chart specs capture the
computations. See [analytics behaviour](analytics.md) for the remaining API semantics.

## Obsolete toolchain

The baseline `package.json` has no `grunt`, `karma`, `jasmine` or `coffee` entry.
`angular.json` uses `@angular/build:application` and `@angular/build:unit-test` (Vitest).
`git grep -in grunt d16f6201c -- .github/` and
`git grep -nE '(import|require).*\.coffee' d16f6201c` produce no matches.

| File                             | Baseline evidence                                              | Resolution       |
| -------------------------------- | -------------------------------------------------------------- | ---------------- |
| `Gruntfile.js`                   | Depends on uninstalled legacy task packages; no npm/CI caller. | Delete.          |
| `build.config.js`                | Consumed only by the obsolete task file.                       | Delete.          |
| `env.config.js`                  | Consumed only by the obsolete task file.                       | Delete.          |
| `karma/karma-unit.tpl.js`        | No installed runner or builder uses it.                        | Delete.          |
| `module.prefix`, `module.suffix` | Only referenced by the obsolete task file.                     | Delete.          |
| `migration_progress.sh`          | Counts AngularJS/CoffeeScript, which the app no longer builds. | Delete.          |
| `setup.sh`                       | Unreferenced script installs Node 10 and global Sass.          | Delete (DX-W02). |

The README already documents Node, `npm ci`, Angular CLI, port 4200 and recursive
submodules. Its setup instructions required no rewrite. Build scripts lose the obsolete
`angular18` suffix (DX-W12); deploy callers use `npm start` and are unaffected.
`@eslint/js`, `typescript-eslint`, and `@sentry/cli` are development dependencies, with
matching lockfile flags. Production is the built `dist/browser` artifact. An
`--omit=dev` install cannot build the app because Angular CLI/compiler are development
dependencies; use a full `npm ci` in the build stage rather than claiming otherwise.

## Remaining template inventory

| Baseline template                                                                                                           | Referrers / disposition                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/projects/states/dashboard/dashboard.tpl.html`                                                                      | No source referrer; orphan, retained for a separately scoped cleanup.                                                                                                                                                                                                                         |
| `src/app/projects/states/dashboard/directives/student-task-list/student-task-list.tpl.html`                                 | No source referrer; orphan, retained for a separately scoped cleanup.                                                                                                                                                                                                                         |
| `src/app/projects/states/dashboard/directives/task-dashboard/directives/task-assessment-card/task-assessment-card.tpl.html` | No source referrer; orphan, retained for a separately scoped cleanup.                                                                                                                                                                                                                         |
| `src/app/projects/states/dashboard/directives/task-dashboard/directives/task-due-card/task-due-card.tpl.html`               | No source referrer; orphan, retained for a separately scoped cleanup.                                                                                                                                                                                                                         |
| `src/app/projects/states/dashboard/directives/task-dashboard/directives/task-submission-card/task-submission-card.tpl.html` | No source referrer; orphan, retained for a separately scoped cleanup.                                                                                                                                                                                                                         |
| `src/app/projects/states/dashboard/directives/task-dashboard/task-dashboard.tpl.html`                                       | No source referrer; orphan, retained for a separately scoped cleanup.                                                                                                                                                                                                                         |
| `src/app/units/states/analytics/analytics.tpl.html`                                                                         | No source referrer; orphan, retained for a separately scoped cleanup.                                                                                                                                                                                                                         |
| `src/app/visualisations/visualisation.tpl.html`                                                                             | `src/app/visualisations/progress-burndown-chart.coffee`; `src/app/visualisations/summary-task-status-scatter.coffee`; `src/app/visualisations/target-grade-pie-chart.coffee`; `src/app/visualisations/task-completion-box-plot.coffee`; `src/app/visualisations/task-status-pie-chart.coffee` |

The chart `visualisation.tpl.html` is deleted with its final CoffeeScript users.
`about-doubtfire-modal-content.tpl.html`, called out as live in the August workbook,
is no longer present at this baseline. Do not recreate it. Remaining `.tpl.html` files
are excluded from ESLint and are not routed by the Angular build.

## Existing setup fixes: verify, do not duplicate

- **DX-W01:** `.nvmrc` is `v22.22.3`, `.tool-versions` is `nodejs 22.22.3`, and
  `package.json` requires `>=22.22.3`. Fixing commit:
  `27f1012bf7cd01f81a4fe5725a3be545288a03cd` (24 August 2026).
- **DX-W13:** README Getting Started and production instructions initialize
  `JPlag-Report-Viewer`; the post-build check verifies the copied assets. Fixing commit:
  `bd5e1d66b` (24 August 2026), followed by `8ef1be045`. `.gitmodules` and the
  `angular.json` asset entry agree. No install hook is needed to duplicate the guide.

These are source-verified outcomes; no Planner card or approval state was changed.
