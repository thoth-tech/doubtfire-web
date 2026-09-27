# Peer Progress Indicator accessibility review checklist

**Scope:** A reusable review checklist for the existing PPI, not a completed audit,
WCAG compliance claim, or a new widget implementation. No application, API or
deployment behavior changes in this document.

This maintains ReneeSleepy's checklist from
[web #247](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/247).
The [original PDF](https://github.com/ontrack-features-t2-2026/doubtfire-web/blob/53f6d11340eba4d53e245184507ff3f91743761b/docs/Peer%20Progress%20Indicator.pdf)
remains in its source commit. This Markdown version is the canonical checklist,
avoiding two identical PDFs and allowing accessible reading on narrow screens.

## Reuse existing work

- [PPI help/privacy copy](ppi-help-text-pack.md): wording intent and privacy limits.
- [Unit-summary handover](ppi-f02-unit-summary-handover.md): unit-level scope and
  the distinction between demonstration data and a live API.
- [A11Y-V01 validation notes](A11Y-V01-validation-notes.md): existing evidence and
  its limitations. Record new checks against the current revision.
- [Theme contract](theme/THEME-CONTRACT.md): shared Light, Dark and System tokens.
- [Current task-level template](../src/app/projects/states/dashboard/directives/task-dashboard/directives/task-description-card/ppi-widget/ppi-widget.component.html)
  and [component tests](../src/app/projects/states/dashboard/directives/task-dashboard/directives/task-description-card/ppi-widget/ppi-widget.component.spec.ts).

The task-level widget already has compact and Advanced views. It prefers a
completion percentage and retains submission percentage as a fallback for older
API responses. The separately documented unit-summary demonstration is not proof
of a live unit-level API. Do not rebuild either feature to complete this checklist.

## Test setup and evidence

Record the web commit, API/deploy revision if used, fixture/state, route, browser
version, OS, screen reader, viewport, theme and test date. Use synthetic accounts
and sanitised evidence; include no student names, identifiers or assessment data.

Use desktop and narrow widths including **320 CSS pixels** and a representative
phone width such as 390. Check 200% text/browser zoom and the equivalent reflow
case of 400% at a 1280-pixel viewport. Repeat relevant controls in landscape and
with the on-screen keyboard open when it affects the workflow.

Use keyboard-only navigation plus NVDA/Windows and VoiceOver/Safari where available.
For the mobile app, record whether the test is in the browser or the installed
standalone PWA; check iOS VoiceOver or Android TalkBack on a real device when
available. Browser viewport emulation does not establish device/screen-reader or
installed-PWA success. Record unavailable combinations as **not tested**.

## 1. Text alternatives and state meaning

- [ ] The compact value and progress bar have meaningful accessible names and
      agree on the percentage and whether peers **completed** or **submitted**.
- [ ] Normal and real zero values are distinguished from loading, no data,
      hidden/suppressed, unavailable, stale, disabled, preference-disabled and
      error states. Check states supported by the current component separately.
- [ ] The Advanced breakdown provides visible status labels and numbers as well
      as color. Its accessible summary conveys the same information.
- [ ] Privacy-rounded values are not presented as exact counts or stretched to
      imply an exact total of 100%; independent-scale explanations are available.
- [ ] Decorative icons are hidden from assistive technology. Meaningful visual
      information has a text equivalent, rather than redundant icon announcements.
- [ ] Suppressed/unavailable states expose no hidden percentage, exact cohort
      size, peer identity or ranking in DOM text, ARIA labels, titles or tooltips.

## 2. Color and contrast

- [ ] Normal text reaches 4.5:1 and large text 3:1 against its actual rendered
      background; meaningful non-text boundaries and indicators reach 3:1 where
      WCAG requires it. Record foreground/background and measured ratio.
- [ ] Check Light, Dark and both resolved System appearances, including a change
      in the OS preference while System is selected.
- [ ] Check muted/disabled/status text, focus indicators, bars and legend labels;
      include opacity and layered backgrounds in the measurement.
- [ ] Meaning never depends only on color. Inspect a grayscale/color-vision
      simulation alongside the text/semantic equivalents.

## 3. Labels and controls

- [ ] The widget title identifies the region and multiple widget instances do
      not reuse IDs or point to another widget's title/panel.
- [ ] The Advanced control has a meaningful name, reports its state, and relates
      to the controlled content. Its accessible behavior matches the rendered role.
- [ ] Help, disclosure or tooltip controls, if present, have clear names and work
      with keyboard and touch; no essential explanation requires mouse hover.
- [ ] Links describe their destination. Applicable form errors explain the
      problem and recovery action; mark absent forms as not applicable with a reason.

## 4. Keyboard, touch and reflow

- [ ] Every interactive control is reachable with Tab/Shift+Tab, has visible
      focus, and responds to Enter/Space or the keys appropriate to its role.
- [ ] Expanding/collapsing Advanced preserves sensible focus and reading order;
      no hidden control remains focusable and no keyboard trap is introduced.
- [ ] Touch controls remain distinguishable and usable without overlapping targets.
      Verify the applicable WCAG 2.2 target-size requirement and spacing exceptions.
- [ ] At 320 and 390 CSS pixels, text wraps and controls/values remain available
      without horizontal page scrolling, clipped content or overlapping controls.
- [ ] Zoom/text enlargement and portrait/landscape preserve every essential value,
      explanation and action. Check the surrounding task page, not only a demo card.

## 5. Screen-reader wording and updates

- [ ] Heading/region structure and reading order make the title, value, comparison,
      status and Advanced content understandable in context.
- [ ] Generic containers do not rely on unsupported ARIA naming; named groups and
      progress bars expose their intended roles and values in the accessibility tree.
- [ ] Completion is not announced as submission, and a real 0% is not announced as
      missing data. Labels do not frame the student as ahead/behind or predict a grade.
- [ ] Loading, failure and updated results can be understood without repeatedly
      announcing the entire widget. Inspect the existing live region before adding
      another; verify actual announcements rather than assuming ARIA attributes suffice.
- [ ] Toggle/state updates and API refreshes do not move focus or announce private
      data that is absent from the visible privacy-safe state.

## Record each result

For every applicable check record **pass**, **fail**, **not tested**, or
**not applicable (with reason)**, plus steps, expected/observed result and a link to
the evidence. Attach screenshots for layout/contrast and a transcript or recording
for screen-reader behavior; automated component tests alone are not manual evidence.

Record the severity and a linked fix for failures. Re-test the exact corrected
commit in the original failing environment. An untested state or device stays
untested; this checklist does not certify that PPI or OnTrack meets WCAG 2.2 AA.
