# CSS style guide (MG-05)

Use this guide for new components and incremental layout migration. It describes
repository conventions verified against `11.0.x` at `d16f6201c` on 20 September 2026.
The layout status below was rechecked on 21 September 2026 against `11.0.x`
at `283b493367681d1abab23e5fe7c633ba3a57e5c2`. On that date, the requester confirmed
that they knew of no external CSS guide. This records the requester's knowledge;
it does not claim a conversation or approval from Brian/Maple.
The [theme contract](theme/THEME-CONTRACT.md) governs colour and theme behaviour.

## Choose the existing layer

1. **Angular Material** supplies interactive components: buttons, form fields,
   dialogs, menus, cards. For example, `common/edit-profile-form` uses Material
   fields and `units/states/analytics/unit-analytics-route.component.html` uses cards
   and buttons. Keep their keyboard and accessible-name behaviour.
2. **Tailwind utilities** express layout, spacing and responsive dimensions. Use
   existing patterns such as `flex flex-col gap-2.5` in the analytics route. Read
   `tailwind.config.js`: `important: true` makes generated utilities important, so
   they can override normal Material/component declarations of the same property.
   Do not fight that policy with local `!important` escalation. The global `[hidden]`
   rule deliberately preserves Angular visibility bindings over display utilities.
3. **Shared SCSS** lives under `src/styles/`. Reuse
   `common/variables.scss`, `common/typeface.scss`, `common/doubtfire-panel.scss`,
   `common/hero-sidebar-layout.scss`, `common/task-status-colors.scss`, and existing
   `mixins/scrollable.scss`, `mixins/task-list.scss` and
   `mixins/task-status-colors-generator.scss` before inventing another helper.
4. **Component SCSS** handles local structures the preceding layers do not cover,
   such as chart dimensions and tables in `visualisations/unit-analytics-chart.scss`.
   Keep selectors scoped; avoid reaching into unrelated components or Material internals.

`src/theme.scss` is the live Material theme (also listed in `angular.json`).
`src/styles.scss` loads it with `@use 'theme' as *`; `styles/m3-theme.scss` remains
commented out. The shared light/dark `--ot-*` tokens are loaded from
`src/styles/tokens/`. Follow those tokens for new theme-sensitive surfaces; the
existing two Tailwind custom colours are `formatif-blue` (`#3939ff`) and
`formatif-blue-lighter` (`#e7e7ff`), used by `common/f-chip/chip.component.html`.
They are the only custom Tailwind colours, not the only colours/tokens in the app.
The `dark:` variant follows `[data-ot-theme="dark"]`, not just the OS preference.

## Rules enforced in CI

The source of truth is `eslint.config.js`; Tailwind reads
`src/tailwind-intellisense.css`, which loads `tailwind.config.js`.
The following warnings apply to `**/*.component.html`. `npm run lint` runs
`ng lint --max-warnings 0`, so warnings fail the gate in `.github/workflows/lint.yml`.
Run the fixer to get the precise class order for the installed Tailwind version.

| Rule                             | Invalid example | Correction                                                                           |
| -------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `classnames-order`               | `p-4 flex`      | `flex p-4`                                                                           |
| `enforces-shorthand`             | `px-4 py-4`     | `p-4`                                                                                |
| `no-contradicting-classname`     | `flex block`    | Pick the required display, e.g. `flex`.                                              |
| `no-unnecessary-arbitrary-value` | `p-[16px]`      | `p-4` when the active spacing scale produces the same size. Check the rendered size. |

`no-custom-classname` is deliberately **off**, allowing shared/component SCSS
classes alongside utilities. `.tpl.html` is globally ignored because these are
legacy templates, not a pattern for new components. See the
[remaining inventory](migration/legacy-audit.md).
[CONTRIBUTING.md](../CONTRIBUTING.md) covers ESLint, Prettier and the npm commands.
The former `MIGRATION-GUIDE.md` was deleted on 15 September; do not follow old
copies that instruct AngularJS downgrades or Bootstrap conversion.

## Layout migration is complete

Use Tailwind for new layout. Commit `0caa10617` completed the Flex Layout teardown
on 20 September 2026: `ng-flex-layout`, `FlexLayoutModule` and their remaining
template directives are absent from the current application. The
[catalogue](migration/ui-catalogue.md) retains the dated two-template inventory as
historical evidence; it is no longer an outstanding conversion list. Do not
reintroduce the removed dependency when bringing changes forward from older branches.

When porting older code, for `fxLayoutAlign` the first value controls the main axis and the second the
cross axis: a row with `center start` becomes `justify-center items-start`.
`fxFlex` requires inspection of its numeric/basis value. `fxShow`/`fxHide` can need
responsive utilities plus application state; `MediaObserver` has no direct CSS
replacement. Check mobile layouts, focus order and hidden elements after each change.

Bootstrap is absent from dependencies and must not be reintroduced for migrated
components. Old `btn`, `panel`, grid and input-group names in the catalogue are
leftovers to replace after checking local SCSS, not evidence of a supported framework.
