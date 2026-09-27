# Task uploads and chat attachments

This guide covers the companion Safe Uploads changes under review. They become
available after the web and API PRs are reviewed and merged. It builds on
FILE-A01 by Sandil Sithmaka Bandara Weganthale and the existing FILE-F01 upload
requirements component. The earlier design matrix remains a design record;
this guide records the implemented boundaries and corrects audit assumptions.

## Students and staff

Before choosing a task submission, read its required categories, exact formats,
file count and size limit. Expand the list for Code. Provide one file for each
configured requirement. Spreadsheet means CSV, XLS or XLSX and keeps the original
file and all worksheets for download. The PDF contains a download notice. Code
uses the existing curated extension list; rename tricks do not bypass checks.
The task's PDF category means PDF. PostScript was advertised by the browser but
rejected by the API, so it is no longer advertised as accepted.

In task chat, requirements appear above the composer before selection. Use
**Attach a file** or drop a file onto the discussion. The server supplies the
exact formats. Document accepts DOCX; Spreadsheet accepts CSV or XLSX. Images,
PDF and supported audio remain available. Each attachment must be smaller than
30 MB (30,000,000 bytes), and you may select up to five at once.

Review the name, category and size, then **Post Attachment**. **Cancel** removes
that selection and leaves written text unchanged. Each file is posted as its
own comment. Your written draft is separate: use Send when ready to post it.
Uploading status appears while requests are pending. A failure keeps the draft;
choose the file again to retry. Policy errors explain why the server refused it.
A proxy size rejection asks you to use a smaller file.

Paste a screenshot while typing to enter the same image confirmation flow.
Only approved raster images are accepted from the clipboard. Ordinary text paste
still works. Duplicate paste/beforeinput browser events produce one confirmation.

Documents and spreadsheets appear as download cards with the filename and size.
**Download** uses the authenticated task endpoint. Office documents are never
rendered as active content in OnTrack. Existing attachments remain accessible to
authorized users. A removed or unavailable file produces an error, not access to
another task's file.

| Message / situation                    | Action                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Requirements unavailable               | Reload and try again; text comments still work                                  |
| Unsupported format                     | Save in one of the formats listed before selection                              |
| Empty file                             | Open and save the file again; check it contains data                            |
| File too large                         | Reduce size below the displayed limit                                           |
| Malformed, encrypted or active content | Remove password protection/macros/embedded objects; export a clean copy         |
| Legacy XLS in chat                     | Save as CSV or macro-free XLSX; task Spreadsheet requirements still accept XLS  |
| Permission or missing-file error       | Check the current task and contact teaching staff if access should be available |

## Unit chairs

In the task editor's upload requirements, choose a category rather than entering
extensions: PDF, Code, Image, Spreadsheet or Archive. Spreadsheet stores the
stable `csv` identifier and displays CSV/XLS/XLSX to students. Existing `archive`
values retain their meaning. No saved-task migration is needed.

The previous audit found a browser CSV/XLS/XLSX list and assumed the task pipeline
already supported it. The API actually omitted `csv` from category validation
and archive handling. The companion API PR completes these paths. It retains
spreadsheet originals and does not silently convert a workbook to its first sheet.

## Contributors and reviewers

- API authority: `app/helpers/comment_attachment_policy.rb`,
  `spreadsheet_upload_policy.rb`, `file_helper.rb`, and `task_comments_api.rb`.
- Browser policy interface: `src/app/api/models/task-comment/attachment-policy.ts`.
- Composer owns picker, drop and clipboard confirmation. The viewer delegates
  drops to that flow so there is no second permissive allowlist.
- `file-upload-types.ts` owns task browser categories; `upload-category.ts`
  supplies requirement labels. The unit-chair selector uses the same stable keys.
- API validates bytes independently; browser MIME is not trusted. Office files
  undergo ZIP/XML, active-content and external-content checks and remain download-only.
- Task size: configured API limit, 10,000,000-byte fallback, inclusive. Chat size:
  strictly below 30,000,000 bytes. The production proxy default remains 1g; see
  [deploy PR 37](https://github.com/ontrack-features-t2-2026/doubtfire-deploy/pull/37)
  for finite-limit validation, JSON 413 and real API boundary probe commands.

To change a format, first update and review the API policy and validators. Add
success, renamed-content, malformed, size, authorization and safe-download tests.
The browser automatically receives chat picker extensions. For task categories,
update both the API and browser contract and verify original archive retention.
Do not add arbitrary unit-chair extension entry. New formats need a teaching use
case and a security decision; a browser MIME string is not that decision.

Run with the repository's supported Node version (22.22.3 or newer):

```sh
npm run test:ci -- --include='src/app/tasks/task-comment-composer/**/*.spec.ts' --include='src/app/tasks/task-comments-viewer/task-comments-viewer.component.spec.ts' --include='src/app/tasks/modals/upload-submission-modal/task-upload-requirements/*.spec.ts' --include='src/app/api/services/spec/task-comment.service.spec.ts'
npm run typecheck
npm run lint
npm run build -- --configuration development
```

The API regression matrix is in its `docs/uploads/safe-upload-contract.md`.
Tests cover clipboard duplication separately from file selection, failure draft
preservation, exclusion/size/count checks, drag/drop delegation and requirements.
API tests cover upload/download policy, cleanup, safe headers and access denial.

Repeat these browser checks at desktop and a narrow mobile width before release:

1. Create a Spreadsheet requirement and confirm CSV/XLS/XLSX in student guidance.
2. Select, drop and paste an image; confirm exactly once and cancel without losing text.
3. Select DOCX, CSV and XLSX, post, and download from an authorized account.
4. Try excluded, empty and oversize files; verify clear feedback and unchanged draft.
5. Tab through Attach, confirmation Cancel/Post and Download; verify visible focus,
   accessible names and readable requirements at 200% zoom and narrow width.
6. Confirm images/audio/PDF and text-only comments retain their existing behavior.

No malware scanning, cloud-drive links, active Office preview, chat XLS, macro
files, encrypted packages, executables or arbitrary archives are added. Existing
FILE-S01 follow-ups about aggregate quotas and worker recovery remain explicit.
Non-GitHub evidence collection, leadership approval and merging are outside this PR.
