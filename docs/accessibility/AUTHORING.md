# Accessibility contribution guide

Use this guide for frontend changes and reviews. WCAG 2.2 AA is the improvement target, not a claim of compliance. Start with the [merged A11Y-D01 baseline](../A11Y-D01-Accessibility-Baseline_Phase1.md), the [manual regression pack](REGRESSION.md), and the [remediation and handover register](REMEDIATION.md). The register distinguishes merged code, changes awaiting review, and checks still needing a person.

For ticket acceptance and reviewer handover, follow the [closure guide](CLOSURE.md) and [run record](RUN-RECORD.md). The [A01 audit](evidence/a01/A01-LINT-AUDIT.md) records the main-branch findings and the fixed-stack scan separately.

## Controls and structure

- Use `<button type="button">` for actions and `<a [routerLink]="...">` or a real `href` for navigation. Adding `tabindex` to a clickable container does not supply activation keys or button semantics. Keep links and buttons out of other links and buttons.
- Give each input a persistent visible label: `<mat-label>` inside `mat-form-field`, or a native `<label for>` and unique input `id`. A placeholder disappears while typing. A caption describing several controls is ordinary text, not a label for one control.
- Name icon-only controls on the button/link itself. Hide decorative child icons with `aria-hidden="true"`; do not repeat an adjacent status name. Never use `aria-label=""`.
- Keep headings outside selects, options and menus. Use headings for page structure, not font size. Embedded frames need a title describing their purpose; their internal content needs separate testing.
- Use the same authorisation boundaries for hidden accessible names as for visible text. Do not add another student's details, restricted feedback or private URLs to an accessible label.

Existing examples: the [PDF viewer](../../src/app/common/pdf-viewer/pdf-viewer.component.html) labels its search field and distinguishes zoom actions ([PR #174](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/174)); the [active unit task list](../../src/app/units/task-viewer/directives/unit-task-list/unit-task-list.component.html) provides text for status badges ([PR #212](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/212)). Its historical `task-list-item` counterpart is not the student's rendered task list.

## Keyboard, focus and overlays

Every pointer action needs a keyboard path. Native buttons support Enter and Space; native links support Enter. Prefer those behaviours to duplicating click handlers with bespoke key handlers. Make hover-only actions available on focus as well; [PR #118](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/118) covers row actions and comment tools.

Preserve a visible focus indicator in both themes and at narrow widths. Do not use positive `tabindex` or remove outlines without a replacement. Focus order follows the task sequence. A disclosure needs a named control and a truthful expanded state; collapsed controls should not remain keyboard stops.

Use Material/CDK focus management for dialogs. Give the dialog a title with `mat-dialog-title`, use a real element ID in `aria-describedby`, and check initial focus, Tab/Shift+Tab containment, Escape where dismissal is allowed, and focus restoration to the opener. The [confirmation dialog](../../src/app/common/modals/confirmation-modal/confirmation-modal.component.html) demonstrates a visible Material dialog title. Its existence does not prove every dialog is correct.

Use menu semantics for a list of menu actions. A panel containing headings, filters, messages and multiple independent controls needs a structure suited to that content; assigning `role="menu"` does not create one. Tooltips supplement a control's name and must not contain essential instructions available only on hover. Route changes should provide a useful page title and an understandable reading/focus position; check this in the journey rather than assuming the router does it.

## Forms and changing feedback

State the expected format and required fields before submission. Associate hints/errors with the relevant control; preserve values after a failed save and explain how to recover. For multiple errors, provide a concise summary linking to invalid fields when the workflow needs it. Error and success text must remain visible without requiring a user to notice a colour change.

A multiline contenteditable needs a meaningful name, `role="textbox"`, and `aria-multiline="true"`, plus a visible focus indicator and predictable editing behaviour. Test typing, focus, disabled/read-only state and recovery without changing submission or assessment rules.

Use a stable, polite `role="status"` region for non-urgent loading/completion updates where an announcement is needed. Reserve alerts for urgent failures. Do not put the entire comments list or frequently refreshing dashboard in a live region: that repeats old information and interrupts reading. Check that one user action produces one useful message and that inactive content is not announced. The [staff task list](../../src/app/units/states/tasks/inbox/directives/staff-task-list/staff-task-list.component.html) demonstrates an explanatory empty state ([PR #225](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/225)).

## Visual and cognitive checks

Use the shared theme contract for colours and CSS conventions: [theme contract](../theme/THEME-CONTRACT.md) and [contributor guide](../../CONTRIBUTING.md). Theme implementation is owned by the Theme objective; accessibility owns verification of contrast, semantics and usable states.

Measure the actual foreground/background pair: 4.5:1 for ordinary text, 3:1 for large text and meaningful non-text controls/graphics. Check default, hover, focus, selected, disabled where applicable, and error states. Preserve a text, shape or icon distinction for status and urgency. Test both available themes rather than inferring contrast from a palette name.

At 200% and 400% browser zoom and at 320 CSS pixels, controls and essential text must remain reachable without two-dimensional page scrolling. Data tables and necessary diagrams may need their own scroll area. Check text-spacing overrides: line height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em. Content must not clip or overlap.

Respect `prefers-reduced-motion` in CSS and JavaScript animation; a CSS override cannot stop a canvas effect. Keep an equivalent static success/status message. Use direct wording, consistent action names, a clear next step and recoverable errors. Avoid unexpected navigation or submitting while a user merely changes a selection unless that behaviour is clear.

## Verification and PR evidence

Use the Node version in [package.json](../../package.json) and the lockfile. From the repository root:

```sh
npm ci
npm run lint
npm run typecheck
npm run test:a11y
npm run test:ci
npm run build
```

Run targeted component tests through the Angular runner, which compiles templates and sets up the test environment. Do not invoke plain Vitest as a substitute:

```sh
npx ng test --no-watch --no-progress --include='src/app/common/pdf-viewer/pdf-viewer.component.spec.ts'
```

Use the local [expectAccessible helper](../../src/app/common/testing/accessibility.ts) in an asynchronous test with real timers. Render the real component template and attach its fixture to the document before scanning; a detached element is rejected. For example, after configuring the real component and its dependencies with TestBed:

```ts
import {expectAccessible} from 'src/app/common/testing/accessibility';

it('exposes accessible controls', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  expect(element.isConnected).toBe(true);
  const results = await expectAccessible(element);
  expect(results.violations).toEqual([]);
  // Review results.incomplete separately; it is not a list of passing checks.
});
```

For Material menus/dialogs, open the real overlay and scan its attached content, then close it during cleanup. The helper disables **only `color-contrast`** because jsdom cannot measure layout/colour reliably. It does not fetch external stylesheets, apply a severity filter, or maintain an accepted-violations baseline. A detected violation fails with rule names and selectors; incomplete results remain available for manual investigation. Check contrast using the status-colour math tests, compiled theme tests, and actual browser measurements. A clean DOM scan does not establish keyboard activation, geometry, screen-reader output or full WCAG conformance.

Keep behavioural regression tests alongside the scan: accessible state, keyboard activation, focus restoration, errors and announcements. A test that replaces the template with an empty string cannot establish template accessibility. Include a negative case so a removed label or lost key path causes a failure; the [helper tests](../../src/app/common/testing/accessibility.spec.ts) demonstrate unnamed-button and unassociated-label failures.

Preserve the existing theme CI check, `npx vitest run scripts/theme/theme-surfaces.spec.ts`, as well as `test:a11y` and the full Angular suite. The theme script tests compiled styles/configuration directly; Angular component tests still use `ng test`. If the separate coverage PR switches the full suite to `test:coverage`, retain that command and its artifact upload alongside the accessibility gate rather than replacing them.

Record the exact web/API/deploy commit combination, command results and relevant [manual test IDs](REGRESSION.md) in the PR. Mark unrun checks as not run with a reason. Attach only sanitised demonstration evidence. Automated checks find some defects; they do not establish screen-reader usability, complete journeys or full WCAG conformance. A developer and an independent tester should review the evidence before the maintainer merges.
