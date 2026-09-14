# OnTrack pull-request review policy

The required status context `ontrack/review-policy` passes when the current pull
request head has either:

- one approval from a current `ontrack-leads` member; or
- two approvals from distinct current `ontrack-contributors` members.

Approvals from the pull-request author, bots, stale commits, dismissed reviews,
or reviewers whose latest actionable review requests changes do not count.

## Security model

`ontrack-review-policy-signal.yml` is unprivileged and never checks out pull-request
code. A completed signal wakes `ontrack-review-policy.yml` through `workflow_run`.
The evaluator workflow checks out only this directory from the protected default
branch, then mints a short-lived token for the organization-owned GitHub App.

The App is installed only on the three OnTrack Doubtfire repositories and has:

- organization Members: read;
- repository Metadata: read (mandatory);
- repository Pull requests: read; and
- repository Commit statuses: write.

The App has no contents, workflow, administration, merge, or webhook permission.
Its private key is held in `ONTRACK_REVIEW_APP_PRIVATE_KEY` in the
`ontrack-review-policy` environment, which only permits the protected `11.0.x`
branch. Its numeric App ID is held in `ONTRACK_REVIEW_APP_ID`.

The evaluator reports on the pull-request head commit. GitHub gates on the test merge
commit whenever that commit carries a status and only falls back to the head when it
carries none, so reporting on the test merge commit would move the merge gate onto a
commit that carries none of this repository's other checks. The head is also stable,
where the test merge commit is recomputed every time the base branch moves.
A five-minute reconciliation covers team membership and base-branch changes that
do not emit a pull-request review event. Unchanged results are not republished,
which avoids GitHub's per-commit status limit.

## Ruleset integration

Keep the native one-overall-approval rule, stale-review dismissal, and conversation
resolution. Require `ontrack/review-policy` with the OnTrack Review Policy App as
its expected source. Remove the native `ontrack-leads` required-reviewer entry only
after the App status has been observed and made required; otherwise GitHub combines
the native team rules with AND semantics.

Changes to any workflow, the evaluator, or CODEOWNERS should continue to require
one `ontrack-leads` approval through a path-specific native reviewer rule. This is
necessary because any default-branch workflow could otherwise reference the App's
environment secret.
