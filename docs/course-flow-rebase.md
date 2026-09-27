# Course Flow planner

Course Flow lets a signed-in user select a versioned course catalog, arrange its
units into study periods, and save named private plans. Reopening a plan restores
its unit positions and empty periods. Course Flow uses `/api/courseflow`, provided
by the companion API change; it does not request the administrative teaching-unit
catalog or use teaching-unit IDs.

## Using the planner

Open **Course Flow** from the account menu. Choose a course/version and start a
plan, or open one of your saved plans. Name the plan and place units using the
labelled unit, period and position controls. Drag and drop is also available.
Units can be moved, swapped, or removed; removing a period makes its units
available to place again. Save explicitly before leaving. Unsaved edits trigger
confirmation when navigating away or closing the tab.

Plans may be saved while incomplete. Planning checks identify missing required
units, the configured number of electives, prerequisites that are missing or
scheduled too late, and units scheduled outside their configured trimesters.
Passing these checks is **not a certification of degree eligibility**.

Each save replaces the plan atomically. If another session has changed the plan,
the API rejects the outdated save instead of overwriting newer data. The page
keeps local edits available so the user can resolve the conflict. Deleting
also checks the saved version. All map requests are scoped to the signed-in
owner, including requests made by administrators.

## Catalog and API contract

Catalogs come from an administrative JSON import in the companion API repository.
No real institutional curriculum is supplied by this PR. The sample catalog is
explicitly labelled demonstration data and is not automatically seeded.

Each course has a code, name, immutable version, elective count and unit list.
Each unit has a course-specific code, name, required/elective classification,
prerequisite codes and offered trimesters. All listed prerequisites must be
scheduled in an earlier study period. New curricula require a new catalog
version; existing saved plans continue to use the version they selected.

This model supports required units, a fixed elective count, conjunctions of
prerequisites, and trimester availability. Credit-point rules, specialisations,
alternative prerequisite expressions, co-requisites and credit exemptions are
not represented. Only import catalogs whose rules fit the supported model.

| Request                                          | Purpose                                     |
| ------------------------------------------------ | ------------------------------------------- |
| `GET /api/courseflow/courses`                    | Catalogs available to signed-in users       |
| `GET /api/courseflow/courses/:id`                | One versioned catalog                       |
| `GET /api/courseflow/maps`                       | Current user's saved plans                  |
| `GET /api/courseflow/maps/:id`                   | One owned plan                              |
| `POST /api/courseflow/maps`                      | Create a private plan                       |
| `PUT /api/courseflow/maps/:id`                   | Replace an owned plan with version checking |
| `DELETE /api/courseflow/maps/:id?lock_version=N` | Delete the current version                  |

Create/update bodies contain `course_id`, `name`, `periods` and `slots`; updates
also require `lock_version`. A period is `{year, trimester}`. A slot is
`{unit_code, year, trimester, position}`. Trimesters are 1–3, positions 1–4,
years 2000–2200. A plan contains 1–60 unique periods and up to 240 slots. Unit
codes and positions cannot repeat. Every unit must belong to the chosen catalog
and every slot to a declared period. Client-supplied ownership fields are rejected.
Other users' map IDs return 404, invalid plans return 422, and stale versions
return 409. Responses include `issues` and `complete` for the configured checks.

## Integration and verification

Deploy the companion API migration before this web change, then import the
institution's approved catalog using the documented `courseflow:import[path]`
task. An empty catalog produces an explicit empty state. Backend failures are
shown as failures; they are not converted into successful empty responses.

The component tests render the actual template. Service tests check HTTP
methods and payloads; planning checks have separate rule tests. Run:

```sh
npm run test:ci -- --include='src/app/courseflow/**/*.spec.ts' --include='src/app/api/services/course-flow.service.spec.ts'
npm run lint
npm run build
```

The [HTTP integration check](course-flow/http-check.mjs) uses actual authentication
and persistence against a disposable local API with the sample catalog imported.
It exercises ordinary-student access, owner isolation, atomic invalid-save
rejection, empty-period roundtrips, planning issues and optimistic concurrency.
It must not run against production data. The [validation record](course-flow/validation.md)
includes browser evidence and the exact source revisions.

## Original rebase history

The branch retains the 16 original non-merge commits and their authors from
upstream [`new/course-flow` at `e8fb9b983d10cda40c2ce005727387106e04ca40`](https://github.com/doubtfire-lms/doubtfire-web/tree/e8fb9b983d10cda40c2ce005727387106e04ca40).
It was initially rebased onto the fork's `11.0.x` at
`a35f2826ddff8a816175490c108f1794779c3254`, then updated against the current
integration branch. The completed planner replaces the old uncalled CRUD
scaffolding and its ambiguous ID contract. Angular Router, the application's
authentication interceptors and the existing signed-in role guard are retained.
