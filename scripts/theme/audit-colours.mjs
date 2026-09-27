// Reproducible static input to THM-D01. This is not a visual or accessibility verdict.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const ref = process.argv[2];
const files = execFileSync(
  'git',
  ref ? ['ls-tree', '-r', '--name-only', ref, '--', 'src'] : ['ls-files', 'src'],
  {encoding: 'utf8'},
)
  .trim()
  .split('\n')
  .filter((file) => /\.(scss|html|ts)$/.test(file) && !/\.spec\.ts$/.test(file));
// One Git process reads the baseline blobs, avoiding one subprocess per file.
const sources = new Map();
if (ref) {
  const batch = execFileSync('git', ['cat-file', '--batch'], {
    input: files.map((file) => `${ref}:${file}\n`).join(''),
    maxBuffer: 64 * 1024 * 1024,
  });
  let offset = 0;
  for (const file of files) {
    const end = batch.indexOf(10, offset);
    const header = batch.subarray(offset, end).toString('utf8');
    const size = Number(header.split(' ')[2]);
    if (!Number.isFinite(size)) throw new Error(`Cannot read ${ref}:${file}`);
    sources.set(file, batch.subarray(end + 1, end + 1 + size).toString('utf8'));
    offset = end + size + 2;
  }
}
const hits = [];
for (const file of files) {
  const source = ref ? sources.get(file) : readFileSync(file, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    const pattern =
      /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)|(?:color|background(?:-color)?|fill|stroke)\s*:\s*(?:white|black|gr[ae]y)\b|\b(?:bg|text|border)-(?:white|black|(?:gray|slate|neutral)-\d{2,3})\b/gi;
    for (const match of line.matchAll(pattern)) {
      let classification = 'semantic-review';
      if (/^\s*(?:\/\/|\*|<!--)/.test(line)) classification = 'comment-or-example';
      else if (/tokens\/|(?:^|\/)theme\.scss|m3-theme\.scss/.test(file))
        classification = 'palette-definition';
      else if (/print|theme-color/i.test(line) || /manifest/.test(file))
        classification = 'print-or-browser';
      else if (/chart|calendar|gantt|monaco|editor|viewer/.test(file))
        classification = 'special-surface';
      else if (/shadow|gradient/i.test(line)) classification = 'decorative-review';
      hits.push({file, line: index + 1, value: match[0], classification});
    }
  });
}
const counts = {};
for (const hit of hits) counts[hit.classification] = (counts[hit.classification] ?? 0) + 1;
console.log(
  JSON.stringify(
    {
      commit: execFileSync('git', ['rev-parse', ref ?? 'HEAD'], {encoding: 'utf8'}).trim(),
      source: ref
        ? `git revision ${ref}`
        : 'current working tree; use a clean checkout to reproduce a commit',
      scope:
        'tracked SCSS, HTML and TypeScript under src, excluding spec files; regex candidates, not confirmed defects',
      rawHits: hits.length,
      deduplicatedFiles: new Set(hits.map((hit) => hit.file)).size,
      deduplicatedComponentDirectories: new Set(
        hits
          .filter((hit) => hit.file.startsWith('src/app/'))
          .map((hit) => hit.file.slice(0, hit.file.lastIndexOf('/'))),
      ).size,
      classifications: counts,
      hits,
    },
    null,
    2,
  ),
);
