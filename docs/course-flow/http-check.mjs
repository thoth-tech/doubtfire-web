// Real HTTP integration check. Run only against a disposable, seeded local API.
// Import the API's docs/courseflow/sample-catalog.json first. No mocked services.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const base = process.env.COURSEFLOW_API_URL || 'http://127.0.0.1:4320';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a disposable local API');
const checks = [];
const created = [];
let student;
async function request(path, user, method = 'GET', body) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? {Username: user.username, 'Auth-Token': user.token} : {}),
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const text = await response.text();
  return {status: response.status, data: text ? JSON.parse(text) : null};
}
async function login(username) {
  const response = await request('/auth', null, 'POST', {username, password: 'password'});
  assert.equal(response.status, 201, `Login ${username}`);
  assert(response.data.auth_token);
  return {username, token: response.data.auth_token};
}
function passed(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}
try {
  const anonymous = await request('/courseflow/courses');
  assert(anonymous.status >= 400 && anonymous.status < 500);
  passed('anonymous catalog access denied');
  student = await login('student_1');
  const other = await login('student_2');
  const admin = await login('aadmin');
  const catalog = await request('/courseflow/courses', student);
  assert.equal(catalog.status, 200);
  const course = catalog.data.find(
    (entry) => entry.code === 'DEMO-CF' && entry.version === 'QA-2026',
  );
  assert(course, 'Import the explicitly labelled DEMO-CF QA-2026 sample catalog');
  passed('ordinary student can retrieve course catalog');
  const periods = [
    {year: 2026, trimester: 1},
    {year: 2026, trimester: 2},
    {year: 2026, trimester: 3},
    {year: 2027, trimester: 1},
  ];
  const draft = {course_id: course.id, name: `HTTP QA ${Date.now()}`, periods, slots: []};
  let response = await request('/courseflow/maps', student, 'POST', draft);
  assert.equal(response.status, 201);
  let map = response.data;
  created.push(map.id);
  assert.equal(map.complete, false);
  assert(map.issues.some((issue) => issue.code === 'missing_required'));
  assert(map.issues.some((issue) => issue.code === 'elective_count'));
  assert.deepEqual(map.periods, periods);
  passed('student creates an incomplete plan with explicit empty periods');
  for (const user of [other, admin]) {
    assert.equal((await request(`/courseflow/maps/${map.id}`, user)).status, 404);
    assert.equal(
      (await request(`/courseflow/maps/${map.id}`, user, 'PUT', {...draft, lock_version: 0}))
        .status,
      404,
    );
    assert.equal(
      (await request(`/courseflow/maps/${map.id}?lock_version=0`, user, 'DELETE')).status,
      404,
    );
    const listed = await request('/courseflow/maps', user);
    assert(!listed.data.some((entry) => entry.id === map.id));
  }
  passed('other student and administrator cannot read, edit, delete, or list this private plan');
  assert.equal(
    (await request('/courseflow/maps', student, 'POST', {...draft, user_id: 1})).status,
    422,
  );
  passed('client-supplied ownership rejected');
  const slots = [
    {unit_code: 'DEMO101', year: 2026, trimester: 1, position: 1},
    {unit_code: 'DEMO102', year: 2026, trimester: 2, position: 2},
    {unit_code: 'DEMO201', year: 2026, trimester: 2, position: 3},
  ];
  const full = {...draft, slots, lock_version: map.lock_version};
  response = await request(`/courseflow/maps/${map.id}`, student, 'PUT', full);
  assert.equal(response.status, 200);
  map = response.data;
  assert.equal(map.complete, true);
  assert.deepEqual(map.issues, []);
  assert.equal(map.lock_version, full.lock_version + 1);
  const reloaded = await request(`/courseflow/maps/${map.id}`, student);
  assert.deepEqual(reloaded.data.slots, slots);
  assert.deepEqual(reloaded.data.periods, periods);
  passed(
    'whole-plan save and HTTP reload preserve positions, empty periods, and configured rule results',
  );
  assert.equal(
    (await request(`/courseflow/maps/${map.id}`, student, 'PUT', {...full, slots: []})).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/courseflow/maps/${map.id}?lock_version=${full.lock_version}`,
        student,
        'DELETE',
      )
    ).status,
    409,
  );
  passed('stale updates and deletes rejected');
  for (const badSlots of [
    [slots[0], {...slots[1], trimester: 1, position: 1}],
    [slots[0], {...slots[0], position: 2}],
    [{...slots[0], unit_code: 'UNKNOWN'}],
    [{...slots[0], year: '2026'}],
    [{...slots[0], trimester: 4}],
    [{...slots[0], position: 0}],
    [{...slots[0], year: 2028}],
  ]) {
    assert.equal(
      (
        await request(`/courseflow/maps/${map.id}`, student, 'PUT', {
          ...full,
          lock_version: map.lock_version,
          slots: badSlots,
        })
      ).status,
      422,
    );
  }
  const preserved = await request(`/courseflow/maps/${map.id}`, student);
  assert.deepEqual(preserved.data.slots, slots);
  assert.equal(preserved.data.lock_version, map.lock_version);
  passed('invalid placements reject atomically without changing stored data or version');
  response = await request(`/courseflow/maps/${map.id}`, student, 'PUT', {
    ...full,
    lock_version: map.lock_version,
    slots: [
      {...slots[0], trimester: 2},
      slots[1],
      {...slots[2], unit_code: 'DEMO202', trimester: 1},
    ],
  });
  assert.equal(response.status, 200);
  map = response.data;
  assert.equal(map.complete, false);
  assert(map.issues.some((issue) => issue.code === 'prerequisite'));
  assert(map.issues.some((issue) => issue.code === 'unavailable_trimester'));
  passed('prerequisite and offering violations are saved as explicit planning issues');
  assert.equal(
    (
      await request(
        `/courseflow/maps/${map.id}?lock_version=${map.lock_version}`,
        student,
        'DELETE',
      )
    ).status,
    204,
  );
  assert.equal((await request(`/courseflow/maps/${map.id}`, student)).status, 404);
  passed('owner deletes the current plan');
} finally {
  if (student) {
    for (const id of created) {
      const latest = await request(`/courseflow/maps/${id}`, student);
      if (latest.status === 200)
        await request(
          `/courseflow/maps/${id}?lock_version=${latest.data.lock_version}`,
          student,
          'DELETE',
        );
    }
  }
  if (process.env.COURSEFLOW_HTTP_RESULT) {
    await writeFile(
      process.env.COURSEFLOW_HTTP_RESULT,
      JSON.stringify({base, checks, completed: checks.length === 10}, null, 2),
    );
  }
}
