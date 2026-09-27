# Cross-project dashboard

The student-only `/dashboard` route shows authorised tasks across active and
previous units. It supports combined unit/task search, status, grade, date and
staff-feedback filters, task ordering, and direct project/task/feedback links.

The dashboard was ported from the old 10.x cross-unit branch onto 11.0.x and
translated from UI-Router to Angular Router. It is now implemented and tested
on `11.0.x`; the original root-level skeleton status is retired.

## Sources and verification

- `src/app/dashboard/f-cross-dashboard.component.{ts,html,scss}` owns mapping,
  filters, grid, density and panel states.
- `src/app/dashboard/list-item/` owns task rows and expanded actions.
- `src/app/app.routes.ts` owns student route access and feedback destinations.
- `src/app/projects/states/index/global-state.service.ts` loads active projects;
  `ProjectService` requests previous units with task definitions in a separate cache.
- The API's `GET /projects` scopes project/task metadata to the authenticated user.

Run `npm run test:ci -- --include='src/app/dashboard/**/*.spec.ts'` using the
repository's Angular Vitest builder. See [UI handover](cross-project-ui.md) for
current validation results, state behaviour and feedback semantics. Review
[privacy-safe evidence guidance](CPD-Q06-privacy-safe-screenshot-checklist.md)
before capturing examples.

## Sample data

These values are entirely synthetic and are intended only as a visual reference for dashboard
mockups. They are not an API schema or an automated-test fixture. Dates use `DD/MM/YYYY`.

| Unit code | Example task due date | Unit completion | Example task status |
| --------- | --------------------- | --------------- | ------------------- |
| COS10001  | 17/10/2026            | 10%             | `not_started`       |
| COS20007  | 19/08/2026            | 100%            | `complete`          |
| COS30046  | 25/08/2026            | 90%             | `working_on_it`     |
