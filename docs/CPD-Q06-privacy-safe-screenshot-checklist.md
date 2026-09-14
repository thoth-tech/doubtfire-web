# Cross-Project Dashboard Privacy-Safe Screenshot Checklist

Use this checklist before sharing a dashboard screenshot in a pull request, Teams message,
report, portfolio, presentation, or handover document.

## Before sharing

- [ ] Real student names have been removed or replaced with mock names.
- [ ] Student IDs and email addresses are not visible.
- [ ] Personal account details and profile images are not visible.
- [ ] Unit and project information does not reveal a student's private enrolment details.
- [ ] Task titles do not contain sensitive or personally identifying information.
- [ ] Marks, feedback text, and individual assessment results are removed, permanently
      redacted in the final exported image, or replaced with mock data.
- [ ] Extension details and changed due dates do not reveal private student circumstances.
- [ ] Browser tabs, URLs, tokens, local file paths, and account information are cropped out or
      permanently redacted in the final exported image.
- [ ] Mock or seeded data has been used wherever possible.
- [ ] The screenshot contains only the area needed to prove the result.
- [ ] The final exported screenshot has been reopened and checked at full size to confirm that
      no sensitive data remains.
- [ ] The original unredacted screenshot is not committed to Git, attached to the pull request,
      or posted in a shared project channel.

## Safe example

A screenshot of the dashboard populated entirely with seeded demo data. For example, students
named "Test Student 1" and "Test Student 2" with placeholder emails, generic task titles, and
sample marks that were never tied to a real person. The screenshot is cropped tightly to the
feature being demonstrated, with no browser chrome, URL bar, or login or account menu visible.

## Information that must be removed

A screenshot taken from a real unit that shows an actual student's name, ID, or email next to
their real mark, feedback comment, or an approved extension with a reason attached. This kind
of detail must be cropped out, permanently redacted in the final exported image, or replaced
with mock data before sharing. Do not rely on light blur or pixelation to protect sensitive
information.

## Recommendation

The safest default for future contributors is to demonstrate features using mock data rather
than real student or account data, even when it takes a little longer to set up. When redaction
is unavoidable, export a flattened copy, reopen that final file, and check it again before
sharing.
