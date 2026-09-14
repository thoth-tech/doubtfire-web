# Theme Support MVP - validation plan, written before the work exists

**Status: NOT RUN. This is a plan, not a record.** No validation has been
performed. Nothing in this file is a result, an outcome or a finding about the
theme feature, because on the date below the theme feature does not exist in any
form that can be validated.

Ticket: THM-MVP01. Objective: Light, Dark, and System Theme Support.
Written: 27 August 2026. Validation cannot start before the objective does.

## What this file is, and what it is not

It **is** the instrument the final validation will be run from. It fixes the
dependency register, the exact commands, the manual check matrix, the route
matrix, the evidence rules, the handover skeleton and the sign-off list ahead of
time, so the checklist cannot be quietly written to fit whatever happens to land.

It is **not** evidence that any of that was done. Every cell that would hold a
result says `NOT RUN`, and every table that would hold rows carries a single
placeholder row instead. Those are deliberate, not an oversight. Filling one in
before the run is the exact failure this ticket exists to prevent.

If you are reading this looking for the outcome of the theme MVP validation, it
is not here yet. Come back when the status line at the top has changed.

## Dependency register, read 27 August 2026

**As of 27 August 2026 every ticket in this objective is Not started, including
THM-MVP01 itself.** The objective holds seventeen THM tickets. Sixteen of them are
dependencies and are listed below, alongside the two migration tickets the
checklist also needs. Nothing has been built, so there is nothing to validate.

Nothing here is overdue. The earliest due date in the table is 9 September 2026
and this plan was written on 27 August 2026, so Not started is the expected state
for all of them. The table records the position on one named date. It is not a
progress judgement on anybody.

| Depends on | Owner | Due | Status, 27 Aug 2026 |
|---|---|---|---|
| THM-JL01 objective, approved branch path, ownership, MVP boundaries | Sanjana Bottu | 2026-09-20 | Not started |
| THM-D01 audit and dark-mode blocker map | Owen Costin | 2026-09-20 | Not started |
| THM-D02 theme contract and semantic design tokens | Samridh Limbu | 2026-09-09 | Not started |
| THM-F01 theme foundation, System detection, persistence, no-flash startup | Maple 'Ryan' Fox | 2026-09-13 | Not started |
| THM-F02 accessible Light, Dark, System preference control | Gaurav Myana | 2026-09-20 | Not started |
| THM-F03 Tailwind dark variant on the approved root marker | unassigned | 2026-09-13 | Not started |
| THM-F04 no-flash startup mechanism | unassigned | 2026-09-13 | Not started |
| THM-B01 persist the preference on the user account | unassigned | 2026-09-16 | Not started |
| THM-M01 application shell and shared components | Duong Bao Huy Tran | 2026-09-16 | Not started |
| THM-M02 core student workflows | Swyam Khare | 2026-09-18 | Not started |
| THM-M03 tutor, unit chair and administration workflows | Gaurav Myana | 2026-09-18 | Not started |
| THM-M04 charts, calendars, editors, viewers, print, offline | Leeon Gourav Rangey | 2026-09-18 | Not started |
| THM-M05 sequence the migration against the FlexLayout teardown | unassigned | 2026-09-09 | Not started |
| THM-W01 installed-app splash and address-bar colours for dark | unassigned | 2026-09-18 | Not started |
| THM-T01 automated theme tests and visual regression matrix | David Tenni | 2026-09-16 | Not started |
| THM-Q01 independent accessibility, cross-browser, responsive, usability pass | Nephat Komu Muriithi | 2026-09-20 | Not started |
| MG-04 catalogue of components on the old design language | unassigned | 2026-09-14 | Not started |
| MG-05 CSS style guide | unassigned | 2026-09-14 | Not started |

Seven of the eighteen have nobody on them. MG-04 and MG-05 in particular block
checklist item 2, which cannot be answered at all until they have an owner.

### Evidence for "Not started", repeatable in about a minute

The board is one source. Git is the other, and it is the one a reviewer can check
without a Planner login. Both agree.

```bash
export PAGER=cat GH_PAGER=cat GIT_PAGER=cat

# 1. No theme branch on any repo in the org. 0 of 160 heads matched,
#    re-read 27 August 2026 after the MVP closure merge landed on 11.0.x.
for r in doubtfire-web doubtfire-api doubtfire-deploy github-guide; do
  echo -n "$r: "
  git ls-remote --heads "https://github.com/ontrack-features-t2-2026/$r.git" \
    | grep -Eic 'theme|thm|dark'
done

# 2. No theme pull request, in any state. 0 of 210 pull requests matched,
#    re-read the same day.
for r in doubtfire-web doubtfire-api doubtfire-deploy; do
  echo -n "$r: "
  gh pr list --repo "ontrack-features-t2-2026/$r" --state all --limit 2000 \
    --json number,title,headRefName \
    --jq '[.[] | select((.title|test("(?i)theme|THM-")) or (.headRefName|test("(?i)theme|THM-")))] | length'
done

# 3. The theme contract THM-D02 defines is on no branch of origin. Check every
#    head, not just 11.0.x, or this only proves it is missing from one branch.
git fetch origin --prune
git ls-remote --heads origin | while read -r sha ref; do
  git cat-file -e "$sha:docs/theme/THEME-CONTRACT.md" 2>/dev/null \
    && echo "contract present on ${ref#refs/heads/}"
done
echo "no line above means the contract is absent from every branch on origin"
```

Results on 27 August 2026: every count in steps 1 and 2 returned `0`, and step 3
printed no branch line, across all 81 heads on `doubtfire-web`. Pass `--limit
2000`. The default truncates silently and has already produced a wrong answer of
zero for a different question.

### THM-D02 is a dependency this plan cannot resolve yet

Three things in this plan point at THM-D02: the DOM marker, the browser storage
key and the validated theme enum. **All three are unresolved references.** THM-D02
is Not started, and `docs/theme/THEME-CONTRACT.md` is absent from every branch on
`origin`, verified by step 3 above. A draft of that contract is committed on a
local branch that has never been pushed, so it is not on `origin` and nobody else
on the team can read it. It has not been reviewed and it has not landed, so it is
not a source this plan may quote.

This plan therefore names those three things by role and never by value. Do not
substitute a guess. Every place below marked **depends on THM-D02** stays
unresolved until that document is merged, and the first job of whoever runs this
validation is to replace the role with the approved name and record where it came
from.

## Scheduling clash, for the objective lead

THM-MVP01 is due **20 September 2026**. Four of the tickets it must validate,
THM-JL01, THM-D01, THM-F02 and THM-Q01, are due on that same day. A validation
ticket cannot fall due at the same moment as the work it validates, so one of the
two dates has to move. Either THM-MVP01 moves later than 20 September, or those
four move earlier.

That is a sequencing decision for the objective lead and it is the first thing to
raise. It is written down here rather than left in a chat so it does not get lost.

## What can be started now, and what cannot

| Checklist item | Can start now | Why |
|---|---|---|
| 1. Confirm each child ticket, PR, owner, final status | Partly | The register above exists. No PR and no final status does. |
| 2. Confirm MG-04, MG-05 preserved and linked, THM-D03 not a duplicate | Partly | MG-04 and MG-05 are unassigned. No THM-D03 exists on the board, which is itself the finding. |
| 3. Confirm the integration branch is based on latest approved 11.0.x | No | THM-JL01 has not named a branch, and no theme branch exists. |
| 4. Review the complete diff | No | No diff exists. |
| 5. Final targeted tests, full tests, typecheck, lint, production build | No | The commands are fixed below and can be rehearsed against `11.0.x` now for a baseline. |
| 6. Light, Dark, System, reload, direct-route, live-change, no-flash checks | No | The feature does not exist. The check script below is written. |
| 7. Review THM-Q01 blockers | No | THM-Q01 has not run. |
| 8. Student, tutor, unit chair, admin route matrices | Partly | The route list can be enumerated from the router now. |
| 9. Charts, calendar, editors, viewers, print, offline, browsers | Partly | The surface list can be enumerated from the repo now. |
| 10. Evidence index | Yes | Template below. |
| 11. Contributor attribution, completed vs deferred vs future | Yes | Structure below. |
| 12. Handover, demo, rollback notes, next priorities | Yes | Skeleton below. |
| 13. Lead approval and final PR into 11.0.x | No | Nothing to open a pull request for. |

## Commands the final validation will run

None of these have been run against a theme branch, because there is no theme
branch. Run every one from the theme integration branch once THM-JL01 has named
it. Record the exact output in the evidence index, not a summary of it.

```bash
# 1. Confirm the branch point. This must be an ancestor check, not a guess.
git fetch origin
git merge-base --is-ancestor origin/11.0.x origin/<theme-integration-branch> \
  && echo "based on latest 11.0.x" || echo "BEHIND - rebase before validating"
git rev-list --left-right --count origin/11.0.x...origin/<theme-integration-branch>

# 2. The complete diff, for the unrelated-change review in item 4.
git diff --stat origin/11.0.x...origin/<theme-integration-branch>
git diff origin/11.0.x...origin/<theme-integration-branch> -- ':!*.scss' ':!*.css'

# 3. Automated checks. All four scripts exist in package.json on 11.0.x.
npm run lint          # ng lint --max-warnings 0
npm run typecheck     # ngc -p src/tsconfig.app.json --noEmit
npm run test:ci       # ng test --no-watch --no-progress  (vitest)
npm run build         # ng build

# 4. Record the exact SHAs that were validated.
git rev-parse origin/<theme-integration-branch> origin/11.0.x
```

Branch names come from `git ls-remote --heads origin`, never from `git branch -a`.
On a case-insensitive filesystem the local ref list reports capitalised branches
that do not exist on the server, because an inherited `Feature/` directory folds
later lowercase refs into it.

## Result tables, all empty by design

**Everything from here to the approvals list is a blank instrument.** Every result
cell says `NOT RUN` and every list carries one placeholder row. That is the
intended state of this document until the objective ships. A cell filled in before
its run is a fabricated result, and the point of writing these tables now is that
nobody has to invent one later.

Replace `NOT RUN` with PASS, FAIL or a specific finding only after watching the
check happen. If a check could not be attempted, leave it `NOT RUN` and say why.

### Manual check script

Every row is repeated in Light, Dark and System. "System" means the operating
system setting is changed while OnTrack stays open, not a reload.

| # | Check | Light | Dark | System |
|---|---|---|---|---|
| 1 | First load with no stored preference falls back safely | NOT RUN | NOT RUN | NOT RUN |
| 2 | First load with an invalid stored value falls back safely | NOT RUN | NOT RUN | NOT RUN |
| 3 | No flash of the wrong theme on cold load | NOT RUN | NOT RUN | NOT RUN |
| 4 | Reload preserves the chosen preference | NOT RUN | NOT RUN | NOT RUN |
| 5 | Direct route to a deep URL renders in the right theme | NOT RUN | NOT RUN | NOT RUN |
| 6 | OS preference changed while open, System follows it live | NOT RUN | NOT RUN | NOT RUN |
| 7 | OS preference changed while open, explicit Light or Dark does not follow | NOT RUN | NOT RUN | NOT RUN |
| 8 | Browser and installed-app chrome colour matches the resolved theme | NOT RUN | NOT RUN | NOT RUN |
| 9 | Print output is readable | NOT RUN | NOT RUN | NOT RUN |
| 10 | Offline service worker load renders in the right theme | NOT RUN | NOT RUN | NOT RUN |

Rows 1, 2 and 4 read and write the browser storage key. Row 2 needs the validated
theme enum to know what an invalid value even is. Both **depend on THM-D02** and
cannot be written as concrete steps until that contract lands.

### Route matrix

One pass per role. Fill the route list from the router before the first validation
run rather than from memory.

| Role | Routes covered | Unreadable or broken | Result |
|---|---|---|---|
| Student | NOT RUN | NOT RUN | NOT RUN |
| Tutor | NOT RUN | NOT RUN | NOT RUN |
| Unit chair | NOT RUN | NOT RUN | NOT RUN |
| Administrator | NOT RUN | NOT RUN | NOT RUN |

Surfaces that historically resist theming, each needing a named result or an
approved limitation: charts, calendar, the task editor, the PDF and portfolio
viewers, code blocks, overlays and dialogs, print, offline.

### Evidence index

One row per artefact. A claim in the handover with no row here is a claim the
maintainer cannot check.

| # | Claim | Artefact | Location | Owner | Date |
|---|---|---|---|---|---|
| - | *no rows yet, the validation has not run* | - | - | - | - |

Required artefact types: the final integration pull request, the exact final SHAs,
the output of each command above, the manual check table filled in, screenshots or
a short recording per theme state, the THM-Q01 report with every blocker marked
fixed and retested, and the reviewer names against each approval.

Sanitise every screenshot and recording before it goes in the pack. Use
demonstration data, never real student submissions or real names.

### Contributor attribution

| Ticket | Contributor | What landed | PR |
|---|---|---|---|
| - | *no rows yet, nothing has landed* | - | - |

Keep completed, deferred and future work in three separate lists. Do not fold a
deferred item into the completed list because it was nearly done.

| Accepted limitation | Reason | Owner | Next action |
|---|---|---|---|
| - | *no rows yet* | - | - |

## Handover skeleton

Two documents, both short. Neither has been written.

**User guide.** What the three settings do, where the control is, what System
means, and what happens if the operating system changes while OnTrack is open.

**Technical handover.** The DOM marker and the storage key (**depends on THM-D02**,
which is Not started and not on origin, so both are unresolved names today), where
the semantic tokens live, how Tailwind and the shared SCSS consume them, which
pages were migrated and which were not, how to add a token, how to theme a new
component, and how to run the tests and the visual regression pass.

**Rollback.** The exact revert path, what the application looks like with the
feature off, and whether any stored preference has to be cleared.

**Next priorities.** Ranked, with the reason each one is next.

## Security and privacy sign-off

None of these have been confirmed. Confirm before the final pull request and
record who confirmed each line.

| Line to confirm | Confirmed by | Date |
|---|---|---|
| The feature stores only the validated theme enum (**depends on THM-D02**) | NOT RUN | NOT RUN |
| No assessment data, permission or authorisation behaviour changed | NOT RUN | NOT RUN |
| The stored preference is never evaluated as CSS or as code | NOT RUN | NOT RUN |
| Screenshots and recordings in the evidence pack are sanitised | NOT RUN | NOT RUN |

## Approvals

Left unticked, and they stay unticked. An approval belongs to the approver, not to
the author of this file.

- [ ] Objective lead, THM-JL01
- [ ] Frontend reviewer
- [ ] Accessibility reviewer
- [ ] Maintainer, for the final pull request into 11.0.x
