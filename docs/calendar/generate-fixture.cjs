// Pass the absolute path of a bundle built from src/app/api/services/ics-calendar-builder.ts.
const {buildIcsCalendar} = require(process.argv[2]);
const {join} = require('node:path');
const {writeFileSync} = require('node:fs');
const cases = [
  [900001, '1P', 'Year boundary', [2026, 11, 31]],
  [900002, '2C', 'Melbourne daylight saving starts', [2026, 9, 4]],
  [900003, '3D', 'Leap day', [2028, 1, 29]],
  [
    900004,
    '4HD',
    'Unicode café 📅; commas, slashes \\ and\nline breaks — ' + 'é'.repeat(40),
    [2026, 8, 20],
  ],
];
const tasks = cases.map(([id, abbreviation, name, date]) => ({
  unit: {id: 9000, code: 'CAL-TEST'},
  definition: {id, abbreviation, name},
  localDueDate: () => new Date(...date),
}));
writeFileSync(
  join(__dirname, 'calendar-compatibility.ics'),
  buildIcsCalendar(tasks, new Date('2026-09-20T00:00:00Z')),
);
