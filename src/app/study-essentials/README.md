# Study essentials

Import `StudyEssentialsComponent` into a standalone component's `imports` and use
`<f-study-essentials />`. It takes no inputs and makes no API requests.

The shared deployment choice is `studyEssentialsProfile` in
`study-essentials.config.ts`. This Deakin fork sets it to `'deakin'`. Operators at
other institutions should set it to `''` before building to hide the panel, or
add a reviewed institution profile. Development, production and the demo all use
the same choice. Product names, emails and unit codes never select a profile.

These are outbound public entry points. Each service controls its own sign-in
and permissions. No credentials, enrolment details, meeting links or course IDs
are appended. Unit-specific course and meeting links belong in scoped unit
content, never this global panel.

The links were checked on 14 September 2026 using Deakin's official pages:

- [Our systems](https://www.deakin.edu.au/students/new-students/new-domestic-students/digital-setup/our-systems) links to DeakinSync and StudentConnect.
- [CloudDeakin](https://www.deakin.edu.au/clouddeakin) links its Single SignOn button to the D2L base URL.
- [Study timetables](https://www.deakin.edu.au/students/study-support/study-timetables) maintains the current STAR destination and calendar guidance. The panel uses this stable page because direct STAR addresses alternate between odd and even years.
- [Library](https://www.deakin.edu.au/library) provides books, articles and unit readings.
- [Student Central](https://www.deakin.edu.au/students/help/student-central) provides course advice and student enquiries.
