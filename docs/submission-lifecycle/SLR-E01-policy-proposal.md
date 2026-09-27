# SLR-E01: proposed post-feedback deadline rule

**Status: Proposed; awaiting stakeholder approval.** This is a decision input, not
approved policy, an implementation specification, or evidence that SLR-E01 is complete.
Merging this document does not authorise changes to student deadlines.

This readable version preserves the proposal contributed by ReneeSleepy in
[web #248](https://github.com/ontrack-features-t2-2026/doubtfire-web/pull/248).
The [original PDF](https://github.com/ontrack-features-t2-2026/doubtfire-web/blob/53f6d11340eba4d53e245184507ff3f91743761b/SLR-E01%20.pdf)
remains in that commit for provenance. It ended partway through its acceptance list;
the complete candidate checks and unresolved decisions are recorded below.

## Existing implementation and duplication check

The API already implements a resubmission extension. Reuse its named methods and
[existing rule record](https://github.com/ontrack-features-t2-2026/doubtfire-api/blob/bb360dfa/docs/submission-lifecycle/effective-resubmission-deadline.md)
before considering new work. This was checked against API `11.0.x` at `bb360dfa`
on 20 September 2026; API #94 is already included in that history.

| Area               | Existing API behavior                                                                                       | Original proposal below                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Eligible statuses  | Fix and Resubmit, Discuss, Rediscuss, Demonstrate                                                           | Same four statuses                                 |
| Eligibility window | Effective deadline less than seven calendar days after assessment                                           | Every eligible feedback event, without that window |
| New date           | Adds configured `extension_weeks_on_resubmit_request` to the existing deadline, subject to limits           | Seven calendar days after feedback was recorded    |
| Repeat handling    | Guard targets one extension per submission round; known concurrency gaps remain                             | Each new eligible feedback event may recalculate   |
| Flexible dates     | Excluded by existing extension eligibility                                                                  | Proposed to participate                            |
| Time zone          | Student campus zone, falling back to application zone; effective deadline uses end-of-day anywhere on earth | Described only as the task/unit system time zone   |
| Configuration      | Unit-level extension configuration                                                                          | Proposed task-level opt-out, enabled by default    |

These are material policy differences, not missing frontend features. The existing
API record also identifies concurrency, transaction and group-comment risks; this
document does not claim to fix them. No API, web behavior, mobile behavior, deploy
configuration, migration or notification delivery changes are included here.

## Original proposed rule

When feedback is recorded with **Fix and Resubmit**, **Discuss**, **Rediscuss**, or
**Demonstrate**, calculate a candidate deadline seven calendar days after the
recorded feedback timestamp. Do not calculate the candidate by adding seven days
to the old deadline or by adding a fixed 168 hours.

The author's proposed interactions are:

- Preserve any later approved extension rather than reducing it.
- Include tasks with flexible dates.
- Respect final and maximum dates; an authorised exception to a final deadline
  requires explicit approval.
- Recalculate for each genuinely new eligible feedback event, including another
  event before the current extended deadline.
- Apply a consistent result to the relevant group submission and its member tasks.
- Enable the behavior for existing and new tasks, with an opt-out available to
  authorised staff at task level.
- Apply only to future eligible feedback. Neither deployment, setting changes nor
  old feedback should automatically rewrite historical deadlines.
- Preserve manually authorised changes and explain the actual resulting deadline
  to the student, including any limiting final/maximum date.

The original suggested message was: "Your task deadline has been extended to
[date and time] because you received feedback requiring further action."
It is suitable only when the deadline actually moves later. Wording for no change,
a cap, or an opt-out needs acceptance alongside the final rule.

## Decisions required before implementation

| Decision                 | Why it remains open                                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deadline precedence      | Early feedback plus seven days may be earlier than the original deadline. Decide explicitly whether the original deadline, a manual deadline, an approved extension, and an automatic date may ever be shortened. A possible no-shortening rule is a proposal, not an approved formula. |
| Conflicting caps         | A later approved extension can exceed a stated final/maximum date. Decide which authority wins and what exception record is required; do not silently truncate an approved extension.                                                                                                   |
| Authoritative time zone  | Choose campus, unit or another named IANA zone and a fallback. Define whether the result is a wall-clock instant or an end-of-day date; current API semantics must not be changed implicitly.                                                                                           |
| DST transitions          | Define the handling of nonexistent or repeated local times, in addition to using calendar days. Include forward and backward clock changes in tests.                                                                                                                                    |
| Feedback identity        | Define a genuinely new event versus a retry, re-save, repeated status change, or resubmission round. Decide whether the current one-extension-per-round rule changes. Duplicate delivery must remain idempotent.                                                                        |
| Flexible and group tasks | Confirm the flexible-date change and how per-member deadlines, campus zones and manual extensions interact for groups.                                                                                                                                                                  |
| Settings and rollout     | Confirm default-on behavior, staff permissions, unit-level configuration interaction, effective start time and treatment of existing extension records.                                                                                                                                 |
| Communication            | Decide the authoritative API fields and whether the explanation is a discussion entry, in-app notice, push/email, or a combination. A visible message does not prove notification delivery.                                                                                             |

No stakeholder approval was supplied with this PR. The authorised policy owner
must record their name/role, decision date, chosen rules, rationale and approval
reference before SLR-E02 to SLR-E05 can treat this as an accepted contract.

## Worked examples from the proposal

All dates below illustrate the proposed local-calendar calculation. The zone and
deadline precedence still require the decisions above; these are not assertions
about current API output.

| Case                             | Input                                                              | Proposed candidate / result                                                                                            |
| -------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Normal                           | Original 20 Sep 2026 17:00; Fix and Resubmit recorded 15 Sep 14:00 | 22 Sep 14:00, before applying any authorised caps                                                                      |
| Feedback after original deadline | Original 15 Sep 17:00; Discuss recorded 16 Sep 10:00               | 23 Sep 10:00, before caps                                                                                              |
| New feedback event               | First feedback 10 Sep 09:00; next eligible event 14 Sep 15:00      | Candidates 17 Sep 09:00 then 21 Sep 15:00; a replay of either event is not a new event                                 |
| Approved extension               | Approved extension dated 25 Sep; feedback 18 Sep 10:00             | Candidate 25 Sep 10:00; the approved extension's exact time/zone is missing, so the later value cannot be selected yet |
| Task opt-out                     | Setting disabled; feedback 18 Sep 10:00                            | No automatic deadline change under the proposal                                                                        |

Add an early-feedback example (original 30 September, feedback 15 September,
candidate 22 September) to the policy decision: blindly replacing the original
would shorten the available time by eight days.

## Candidate acceptance checks after policy approval

- Each eligible outcome follows the accepted formula; ineligible outcomes do not
  change the deadline.
- Early, on-time and late feedback follow the explicit precedence rules.
- Later approved/manual deadlines and final/maximum caps follow the recorded
  authority decision, including a conflict between a later extension and a cap.
- A genuinely new event follows the repeat policy; retries, duplicate delivery,
  concurrent assessments and failed transactions do not stack extensions.
- Spring/autumn DST, missing time zones, and cross-zone group members produce the
  agreed date and offset; seven calendar days are not assumed to be 168 hours.
- Flexible dates, group propagation, unit settings and task opt-out follow the
  accepted configuration and permission rules.
- Deployment and configuration changes leave historical feedback/deadlines intact
  unless a separately approved migration explicitly says otherwise.
- Desktop web and the installed mobile PWA show the same server result, including
  a readable date/time/zone, accessible feedback explanation, and any cap/no-change
  wording. Do not recalculate the policy separately in each client.

Use synthetic accounts and dates for evidence. Link the exact API/web/deploy
revisions and test results after implementation; none are claimed by this proposal.
