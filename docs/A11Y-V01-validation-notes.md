# A11Y-V01 — Independent Accessibility Validation

**Date:** 18 September 2026

**Validation branch:** `test/a11y-phase1-validation`

**Integrated branch:** `origin/11.0.x`

**Baseline:** `518abe8f1ab870175379a5aed992e1035bae987d`


## 1. Validation setup

Validation was completed against the integrated `origin/11.0.x` baseline. No application code changes were made on the validation branch.

**Environment:** Node `v22.23.1`, npm `10.9.8`, Linux, Orca 42.0, 200% browser zoom, iPhone 15 Pro mobile viewport.

**Test data:** Synthetic local development data only, 40 users, 4 units, 51 projects and 9 tutorials. Student and tutor test accounts were used. No real student data or identifying participant information was used.

## 2. Automated validation

| Check             | Result                                        |
| ----------------- | --------------------------------------------- |
| `npm run lint`    | **PASS**. All files pass linting              |
| `npm run test:ci` | **PASS**. 141 test files, 1,057 tests, 33.16s |

No dedicated axe, Pa11y, Lighthouse, Playwright or Cypress accessibility scanner is configured in the repository.

## 3. Targeted accessibility tests

### Task visualisation

```text
✓ doubtfire src/app/visualisations/task-visualisation/task-visualisation.component.spec.ts (3 tests)
  ✓ complete status labels without chart ellipsis/false click affordance
  ✓ status cards above 4.5:1 contrast floor
  ✓ route reuse updates counts

Test Files  1 passed (1)
Tests       3 passed (3)
```

**Command:**

```bash
cd /workspace/doubtfire-web && npx ng test --no-watch --no-progress --include='src/app/visualisations/task-visualisation/task-visualisation.component.spec.ts'
```

### PDF viewer

```text
✓ doubtfire src/app/common/pdf-viewer/pdf-viewer.component.spec.ts (3 tests)
  ✓ zoom buttons have different accessible names
  ✓ search field has mat-label and spinner accessible name
  ✓ embedded PDF object titled

Test Files  1 passed (1)
Tests       3 passed (3)
```

**Command:**

```bash
cd /workspace/doubtfire-web && npx ng test --no-watch --no-progress --include='src/app/common/pdf-viewer/pdf-viewer.component.spec.ts'
```

### Unit task list

```text
✓ doubtfire src/app/units/task-viewer/directives/unit-task-list/unit-task-list.component.spec.ts (31 tests)
  ✓ task logic tests
  ✓ status badges accessible names
  ✓ decorative glyphs hidden
  ✓ deadline states use different glyph for non-colour signal
  ✓ collapsed list badges named

Test Files  1 passed (1)
Tests       31 passed (31)
```

**Command:**

```bash
cd /workspace/doubtfire-web && npx ng test --no-watch --no-progress --include='src/app/units/task-viewer/directives/unit-task-list/unit-task-list.component.spec.ts'
```

### Staff task list

```text
✓ doubtfire src/app/units/states/tasks/inbox/directives/staff-task-list/staff-task-list.component.spec.ts (22 tests)
  ✓ keyboard focus reveals row actions without hover
  ✓ focus/blur
  ✓ overflow menu focus
  ✓ empty state descriptive text
  ✓ full message accessible in narrow icon-only sidebar

Test Files  1 passed (1)
Tests       22 passed (22)
```

**Command:**

```bash
cd /workspace/doubtfire-web && npx ng test --no-watch --no-progress --include='src/app/units/states/tasks/inbox/directives/staff-task-list/staff-task-list.component.spec.ts'
```

### Profile and sign-in forms

```text
✓ doubtfire src/app/common/edit-profile-form/edit-profile-form.component.spec.ts
✓ doubtfire src/app/sessions/states/sign-in/sign-in.component.spec.ts

Test Files  2 passed (2)
Tests       24 passed (24)
```

These tests included the A11Y-FORM06 autocomplete-purpose checks.

**Command:**

```bash
cd /workspace/doubtfire-web && npx ng test --no-watch --no-progress --include='src/app/common/edit-profile-form/edit-profile-form.component.spec.ts' --include='src/app/sessions/states/sign-in/sign-in.component.spec.ts'
```


These tests covered accessible names, keyboard focus, status information, PDF controls, forms and contrast-related behaviour.

## 4. Manual validation

| Journey     | Keyboard | Screen reader | 200% zoom | Mobile/reflow | Colour    | Motion   |
| ----------- | -------- | ------------- | --------- | ------------- | --------- | -------- |
| Student     | **PASS** | **PASS**      | **PASS**  | **PASS***     | **PASS*** | **PASS** |
| Staff/tutor | **PASS** | **PASS**      | **PASS**  | **PASS***     | **PASS*** | **PASS** |

* Minor visual observations are documented below.

Both journeys remained usable with keyboard navigation, Orca, increased zoom and normal interaction. No keyboard trap or screen-reader blocker was identified.

The light/dark theme toggle was not visible at 200% zoom or on the mobile layout.

## 5. Defect and visual observations

### D01: Mobile PDF search-box visual issue

**Severity:** Proposed P2 / minor visual issue

**Status:** Open

**Owner:** To be assigned

**Blocks Phase 1 sign-off:** No, based on current evidence

At the mobile viewport, **Task Details → Task Sheet** showed three magnifying-glass icons and minor visual glitching around the left side of the PDF search box when folding/expanding. The search function remained usable.

<img width="240" height="303" alt="Screenshot from 2026-09-18 13-50-39" src="https://github.com/user-attachments/assets/7272f45b-ffd6-41bd-991e-19fc91dcb5ad" />


**Reproduction:** Open a student/staff Task Sheet at the iPhone 15 Pro viewport and fold/expand the PDF search area.

### Progress Dashboard observation

<img width="701" height="542" alt="Screenshot from 2026-09-18 13-51-24" src="https://github.com/user-attachments/assets/57063adb-2b69-4b8a-84e0-5e3ddd7e3522" />

The Progress Dashboard showed a strong visual difference between the white surrounding area and dark/black component boxes.

## 6. Inclusive-UX review

The required review by at least **two independent people** remains outstanding.

Four tasks must be completed:

1. Find the current unit.
2. Find a task to work on.
3. Open the task details/task sheet.
4. Find progress/status information.

My exploratory check is not counted towards this requirement.

**Status: Outstanding.**

## 7. Integration and independence

The validated baseline was:

`origin/11.0.x @ 518abe8f1ab870175379a5aed992e1035bae987d`

Merged accessibility changes in this baseline were included in validation. Changes remaining on separate branches were not merged or used as evidence for integrated sign-off.

The validation branch contains no application code changes or commits beyond the integrated baseline.

A repository search did not identify written A11Y-L01/MISC-X01 approval naming the exact integration branch, so no unverified approval is claimed.

## 8. Validation status

**Status: Partially complete. Independent inclusive-UX review outstanding.**

**Completed:** Automated tests, targeted accessibility tests, student/staff manual journeys, keyboard, screen reader, zoom, reflow, colour and motion checks, defect documentation and keyboard re-test.

**Outstanding:** Two independent reviewers to complete the four inclusive-UX tasks and assignment of an owner for D01.

No P0 or P1 accessibility defects were identified.

This validation does not claim full accessibility compliance or formal accessibility certification.
