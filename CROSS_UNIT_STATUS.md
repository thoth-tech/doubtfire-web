# Cross-Unit (Cross-Project) Dashboard — starting-point status

**Branch:** `feature/cross-unit` (off `11.0.x`) · **Repos:** `doubtfire-web` + `doubtfire-api`
**State:** skeleton ported onto v11.0 and wired — *not yet built/tested* (see Verification).

## What this feature is
A single dashboard that shows a student's tasks across **all** their units in one view
(`/dashboard`, Student-only). Currently a bare unit→task list — the visual/UX build sits on top.

## What landed in this port
Ported from the old `Feature/Cross-Unit` branch (forked ~`10.0.0`, ~561 web / 169 api commits
behind) and **re-homed onto v11.0** — not a git rebase.

### doubtfire-web
- **Clean adds (7 files):** `src/app/dashboard/**` — `f-cross-dashboard`, `list-item/dashboard-list-item`,
  `list-item/expanded-list-item/*`. Verified to compile against v11's `GlobalStateService`
  (`onLoad`, `currentUserProjects.values`).
- **Wiring (4 edits), translated UI-Router → Angular Router:**
  - `app.routes.ts` — new top-level `{path: 'dashboard', component: CrossDashboardComponent,
    canActivate: [roleWhitelistGuard], data: {roleWhitelist: ['Student']}}`.
  - `doubtfire-angular.module.ts` — registered the 3 components in `declarations`.
    ⚠️ **Shared file — coordinate with `feature/notifications` and `peer-progress`.**
  - `home/states/home/home.component.html` — added a "View all" (`/dashboard`) button beside
    "View previous" (`/view-all-projects`); converted `uiSref` → `routerLink`.
  - `projects/states/index/global-state.service.ts` — projects query now sends
    `include_task_definitions: true` (also fixed the latent `include_in_active` → `include_inactive`
    param typo so web matches the API).

### doubtfire-api (`feature/cross-unit` branch there)
- `app/api/projects_api.rb` — new `include_task_definitions` param on `GET /projects`.
- `app/api/entities/project_entity.rb` — expose `tasks` when `include_task_definitions`.
- `app/api/entities/minimal/minimal_unit_entity.rb` — expose `task_definitions` when requested.

## Verification (NOT yet run — do before relying on this)
- web: `npm ci && npm run build && npm run lint`
- api: `bundle exec rubocop` + relevant tests
- manual: log in as a Student → home shows the new button → `/dashboard` renders the unit list.

## What the team builds on top
Task status/colours, due dates, sorting/filtering, Material styling, empty/loading states.
The port only gets the compiling skeleton onto v11 as a shared starting point.
