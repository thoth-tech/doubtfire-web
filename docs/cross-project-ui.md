# Cross-project UI handover

Tickets: CPD-FB02, CPD-FB03, CPD-UI03–06, PR-XU-12, PR-XU-13 and PR-XU-20.
The API's projects logging and access-control tests are maintained separately.
Calendar features are unchanged.

## Feedback and filtering

`has_feedback` maps to `Task.hasFeedback`. `true` means staff feedback exists;
`false` means none exists; missing metadata stays unavailable. No feedback body,
marker note or additional student identity is fetched for a card. The unread
comment count is separate: it cannot establish whether staff feedback is new.
The UI therefore labels it **unread comments**, never **new feedback**.

The Staff feedback selector combines with status, grade, date range and the
existing global/per-unit searches. Search includes the displayed phrases
`staff feedback available`, `no staff feedback`, `feedback unavailable`, and
`unread comments` where applicable. Searching just `feedback` can match any of
these states; use the selector to ask specifically for available feedback.
Clear all restores all feedback states while preserving per-unit controls.

The Staff feedback action navigates to
`/projects/:projectId/dashboard/:abbreviation/feedback`, which opens the existing
feedback pane on narrow screens even after comments have been read. The normal
task title links to task details. Neither route bypasses API authorisation.

## Layout, controls and recovery

The grid wraps cards in DOM order using a minimum bounded by the available width.
Project name, task completion count, deadline warning and project link remain
available in phone summaries. Comfortable/compact density changes spacing,
not data. Long names wrap. Task controls and focus outlines retain their size.

The local `panelState` template accepts `title`, `message` and optional `busy`.
It gives each panel a named section, minimum height and polite status text.
Use plain messages without response bodies or stack traces. Active units,
previous units and recommended order have separate busy/error state. Failed
refreshes retain the last successful data; initial empty results get explicit
messages. Refresh buttons remain mounted and keyboard-focusable while busy,
use `aria-disabled`, and guard repeat activation in their handlers.

Active projects initially come from the application's global loading contract.
The dashboard does not replace the app's sign-in/bootstrap error handling.
Previous projects use a separate cache so loading history cannot contaminate
the active project cache. All component-owned requests stop on destruction.

Filter/sort menus use native buttons with checked states. The result count is
announced in one polite live region; input focus remains on the control that
changed the results. Phone disclosures retain their toggle and `aria-expanded`.
Count badges use the existing `#3939ff` token with white text (6.56:1 contrast),
and explicitly name the count and task. Unread comments are not exposed as an
unexplained digit.

## Validation

Use synthetic projects for browser checks at 320, 390, 768, 1024 and 1440 px,
in both density modes, with long names and enough tasks to scroll. Exercise
available/no/unavailable feedback, no matches, empty units, previous-unit
failure/retry, and a failed refresh with existing data. Tab through every
control; open filters with the keyboard; verify focus survives refresh. At
200% zoom check wrapping and the continued availability of the project link.

The focused component tests cover combined filters, missing metadata, actual
task/feedback hrefs, stale data and recovery, duplicate refresh suppression,
focus retention, counts and density. Route tests cover student access and
scope restoration. Browser, test and build results for this change are recorded
in the [validation record](evidence/cross-project-ui/README.md) and PR. Real screen-reader sign-off remains
a reviewer activity; automated accessible-name assertions do not claim it.
