import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { test } from 'node:test';

import {
  approvedReviewers,
  createAppJwt,
  evaluatePolicy,
  pullRequestNumbersFromWorkflowRun,
  setPolicyStatus,
  statusShaForPullRequest,
} from './evaluate.mjs';

function review({
  id,
  login,
  state = 'APPROVED',
  commit = 'head',
  submitted = `2026-08-24T00:00:${String(id).padStart(2, '0')}Z`,
  type = 'User',
}) {
  return {
    id,
    state,
    commit_id: commit,
    submitted_at: submitted,
    user: { login, type },
  };
}

test('one lead approval passes', () => {
  const result = evaluatePolicy(
    new Set(['lead']),
    new Set(['lead']),
    new Set(['lead', 'contributor']),
  );
  assert.equal(result.passes, true);
  assert.equal(result.leadApprovals, 1);
});

test('two distinct contributor approvals pass', () => {
  const result = evaluatePolicy(
    new Set(['contributor-a', 'contributor-b']),
    new Set(['lead']),
    new Set(['lead', 'contributor-a', 'contributor-b']),
  );
  assert.equal(result.passes, true);
  assert.equal(result.contributorApprovals, 2);
});

test('one contributor approval does not pass', () => {
  const result = evaluatePolicy(
    new Set(['contributor-a']),
    new Set(['lead']),
    new Set(['lead', 'contributor-a']),
  );
  assert.equal(result.passes, false);
});

test('duplicate approvals from one reviewer count once', () => {
  const approved = approvedReviewers([
    review({ id: 1, login: 'Contributor-A' }),
    review({ id: 2, login: 'contributor-a' }),
  ], 'head', 'author');
  assert.deepEqual([...approved], ['contributor-a']);
});

test('a later comment does not revoke an approval', () => {
  const approved = approvedReviewers([
    review({ id: 1, login: 'contributor-a' }),
    review({ id: 2, login: 'contributor-a', state: 'COMMENTED' }),
  ], 'head', 'author');
  assert.deepEqual([...approved], ['contributor-a']);
});

test('a later changes-requested review revokes an approval', () => {
  const approved = approvedReviewers([
    review({ id: 1, login: 'contributor-a' }),
    review({ id: 2, login: 'contributor-a', state: 'CHANGES_REQUESTED' }),
  ], 'head', 'author');
  assert.deepEqual([...approved], []);
});

test('stale, author, and bot approvals are ignored', () => {
  const approved = approvedReviewers([
    review({ id: 1, login: 'stale', commit: 'old-head' }),
    review({ id: 2, login: 'author' }),
    review({ id: 3, login: 'review-bot[bot]', type: 'Bot' }),
  ], 'head', 'author');
  assert.deepEqual([...approved], []);
});

test('workflow run PR numbers are deduplicated and validated', () => {
  assert.deepEqual(
    pullRequestNumbersFromWorkflowRun({
      display_title: 'OnTrack review policy signal for PR #42',
      pull_requests: [{ number: 42 }, { number: 17 }, { number: 0 }],
    }),
    [42, 17],
  );
});

test('workflow run ignores unsafe or implausibly large PR numbers', () => {
  assert.deepEqual(
    pullRequestNumbersFromWorkflowRun({
      display_title: 'OnTrack review policy signal for PR #12345678901',
      pull_requests: [{ number: Number.MAX_SAFE_INTEGER + 1 }, { number: -4 }],
    }),
    [],
  );
});

test('GitHub App JWT has a valid RSA signature and bounded lifetime', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const now = 1_800_000_000;
  const jwt = createAppJwt('4699573', privateKeyPem, now);
  const [header, payload, signature] = jwt.split('.');
  assert.equal(
    verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    ),
    true,
  );
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  assert.equal(claims.iss, '4699573');
  assert.equal(claims.iat, now - 60);
  assert.equal(claims.exp, now + 540);
});

test('unchanged App status is not republished and spoofed sources are ignored', async () => {
  const posts = [];
  const api = {
    async paginate() {
      return [
        {
          context: 'ontrack/review-policy',
          state: 'success',
          description: 'Passed',
          creator: { login: 'not-the-policy-app[bot]' },
        },
        {
          context: 'ontrack/review-policy',
          state: 'pending',
          description: 'Waiting',
          creator: { login: 'ontrack-review-policy-t2-2026[bot]' },
        },
      ];
    },
    async request(path, options) {
      posts.push({ path, options });
      return {};
    },
  };

  assert.equal(
    await setPolicyStatus(
      api,
      'owner',
      'repo',
      'a'.repeat(40),
      'pending',
      'Waiting',
      'https://example.test/run',
    ),
    false,
  );
  assert.equal(posts.length, 0);

  assert.equal(
    await setPolicyStatus(
      api,
      'owner',
      'repo',
      'a'.repeat(40),
      'success',
      'Passed',
      'https://example.test/run',
    ),
    true,
  );
  assert.equal(posts.length, 1);
});

test('status-history failure does not suppress a fail-closed write', async () => {
  const posts = [];
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  const api = {
    async paginate() {
      throw new Error('history unavailable');
    },
    async request(path, options) {
      posts.push({ path, options });
      return {};
    },
  };

  try {
    assert.equal(
      await setPolicyStatus(
        api,
        'owner',
        'repo',
        'b'.repeat(40),
        'error',
        'Evaluation failed',
        'https://example.test/run',
      ),
      true,
    );
    assert.equal(posts.length, 1);
    assert.equal(posts[0].options.body.state, 'error');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('the status is reported on the head, never on the test merge commit', () => {
  assert.equal(
    statusShaForPullRequest({ head: { sha: 'head' }, merge_commit_sha: 'test-merge' }),
    'head',
  );
});

test('a conflicting pull request with no test merge commit still reports on its head', () => {
  assert.equal(
    statusShaForPullRequest({ head: { sha: 'head' }, merge_commit_sha: null }),
    'head',
  );
});
