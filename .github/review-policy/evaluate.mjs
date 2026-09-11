import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const API_VERSION = '2022-11-28';
const POLICY_CONTEXT = 'ontrack/review-policy';
const APP_BOT_LOGIN = 'ontrack-review-policy-t2-2026[bot]';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const ALLOWED_REPOSITORIES = new Set([
  'doubtfire-deploy',
  'doubtfire-api',
  'doubtfire-web',
]);

function normalizeLogin(login) {
  return String(login || '').toLowerCase();
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createAppJwt(appId, privateKey, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!/^\d+$/.test(String(appId))) {
    throw new Error('ONTRACK_REVIEW_APP_ID must be a numeric GitHub App ID.');
  }
  if (!String(privateKey).includes('PRIVATE KEY')) {
    throw new Error('ONTRACK_REVIEW_APP_PRIVATE_KEY is missing or invalid.');
  }

  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeJson({
    iat: nowSeconds - 60,
    exp: nowSeconds + 540,
    iss: String(appId),
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
}

export function approvedReviewers(reviews, headSha, authorLogin) {
  const author = normalizeLogin(authorLogin);
  const latestActionableReview = new Map();
  const actionableStates = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

  const ordered = [...reviews].sort((left, right) => {
    const leftTime = Date.parse(left.submitted_at || 0) || 0;
    const rightTime = Date.parse(right.submitted_at || 0) || 0;
    return leftTime - rightTime || Number(left.id || 0) - Number(right.id || 0);
  });

  for (const review of ordered) {
    const login = normalizeLogin(review.user?.login);
    const state = String(review.state || '').toUpperCase();
    if (!login || login === author || review.user?.type === 'Bot') {
      continue;
    }
    // A comment after an approval does not revoke the approval.
    if (!actionableStates.has(state)) {
      continue;
    }
    latestActionableReview.set(login, review);
  }

  return new Set(
    [...latestActionableReview.entries()]
      .filter(([, review]) => (
        String(review.state || '').toUpperCase() === 'APPROVED'
        && review.commit_id === headSha
      ))
      .map(([login]) => login),
  );
}

export function evaluatePolicy(approved, leadMembers, contributorMembers) {
  const leads = new Set([...leadMembers].map(normalizeLogin));
  const contributors = new Set([...contributorMembers].map(normalizeLogin));
  let leadApprovals = 0;
  let contributorApprovals = 0;

  for (const login of approved) {
    const normalized = normalizeLogin(login);
    if (leads.has(normalized)) {
      leadApprovals += 1;
    }
    if (contributors.has(normalized)) {
      contributorApprovals += 1;
    }
  }

  return {
    leadApprovals,
    contributorApprovals,
    passes: leadApprovals >= 1 || contributorApprovals >= 2,
  };
}

export function pullRequestNumbersFromWorkflowRun(workflowRun) {
  const numbers = new Set();
  for (const pullRequest of workflowRun?.pull_requests || []) {
    const number = Number(pullRequest?.number);
    if (Number.isSafeInteger(number) && number > 0) {
      numbers.add(number);
    }
  }

  const title = String(workflowRun?.display_title || '');
  const titleMatch = title.match(/\bPR #([1-9]\d{0,9})\b/);
  if (titleMatch) {
    const number = Number(titleMatch[1]);
    if (Number.isSafeInteger(number)) {
      numbers.add(number);
    }
  }
  return [...numbers];
}

function safeError(error) {
  return String(error?.message || error || 'Unknown error')
    .replace(/gh[opsu]_[A-Za-z0-9_]+/g, '[redacted token]')
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      '[redacted private key]',
    )
    .slice(0, 500);
}

function repositoryParts(repository) {
  const match = String(repository || '').match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) {
    throw new Error('GITHUB_REPOSITORY is invalid.');
  }
  return { owner: match[1], repo: match[2] };
}

class GitHubApi {
  constructor(apiUrl, token) {
    this.apiUrl = String(apiUrl || 'https://api.github.com').replace(/\/$/, '');
    this.token = token;
  }

  async request(path, { method = 'GET', body, expected = [200] } = {}) {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'User-Agent': 'ontrack-review-policy',
        'X-GitHub-Api-Version': API_VERSION,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!expected.includes(response.status)) {
      const requestId = response.headers.get('x-github-request-id');
      throw new Error(
        `GitHub API ${method} ${path} returned ${response.status}`
        + (requestId ? ` (request ${requestId})` : ''),
      );
    }

    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async paginate(path) {
    const items = [];
    const separator = path.includes('?') ? '&' : '?';
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const batch = await this.request(
        `${path}${separator}per_page=${PAGE_SIZE}&page=${page}`,
      );
      if (!Array.isArray(batch)) {
        throw new Error(`Expected a list from GitHub API path ${path}.`);
      }
      items.push(...batch);
      if (batch.length < PAGE_SIZE) {
        return items;
      }
    }
    throw new Error(`GitHub API pagination exceeded ${MAX_PAGES} pages for ${path}.`);
  }
}

async function mintInstallationToken({ apiUrl, owner, repo, appId, privateKey }) {
  const appJwt = createAppJwt(appId, privateKey);
  const appApi = new GitHubApi(apiUrl, appJwt);
  const installation = await appApi.request(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/installation`,
  );
  const tokenResponse = await appApi.request(
    `/app/installations/${installation.id}/access_tokens`,
    {
      method: 'POST',
      expected: [201],
      body: {
        repositories: [repo],
        permissions: {
          members: 'read',
          pull_requests: 'read',
          statuses: 'write',
        },
      },
    },
  );

  if (!tokenResponse?.token) {
    throw new Error('GitHub did not return an installation access token.');
  }
  // Generated tokens are not repository secrets, so mask them explicitly.
  console.log(`::add-mask::${tokenResponse.token}`);
  return tokenResponse.token;
}

async function teamMembers(api, owner, teamSlug) {
  const members = await api.paginate(
    `/orgs/${encodeURIComponent(owner)}/teams/${encodeURIComponent(teamSlug)}/members`,
  );
  return new Set(members.map((member) => normalizeLogin(member.login)));
}

async function openPullRequests(api, owner, repo) {
  return api.paginate(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open`,
  );
}

async function pullRequest(api, owner, repo, number) {
  return api.request(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`,
  );
}

async function reviewsForPullRequest(api, owner, repo, number) {
  return api.paginate(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/reviews`,
  );
}

function runUrl(repository, runId) {
  return `https://github.com/${repository}/actions/runs/${runId}`;
}

async function setPolicyStatus(api, owner, repo, sha, state, description, targetUrl) {
  if (!/^[0-9a-f]{40}$/i.test(String(sha || ''))) {
    throw new Error('Cannot publish the review policy without a valid commit SHA.');
  }
  const clippedDescription = description.slice(0, 140);
  try {
    const statuses = await api.paginate(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
      + `/commits/${encodeURIComponent(sha)}/statuses`,
    );
    const latest = statuses.find((status) => (
      status.context === POLICY_CONTEXT
      && normalizeLogin(status.creator?.login) === APP_BOT_LOGIN
    ));
    if (latest?.state === state && latest?.description === clippedDescription) {
      return false;
    }
  } catch (error) {
    // Deduplication is only an optimization. Always attempt the fail-closed write
    // when status history cannot be read but the status endpoint may still work.
    console.warn(`::warning::Status deduplication failed: ${safeError(error)}`);
  }

  await api.request(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/statuses/${sha}`,
    {
      method: 'POST',
      expected: [201],
      body: {
        state,
        context: POLICY_CONTEXT,
        description: clippedDescription,
        target_url: targetUrl,
      },
    },
  );
  return true;
}

export { setPolicyStatus };

// Report on the pull-request head. GitHub gates on the test merge commit whenever that
// commit carries a status and only falls back to the head when it carries none, and the
// test merge commit carries none of this repository's checks. Reporting there would move
// the whole merge gate onto a commit that CI never sees. The head is also stable while
// the test merge commit is recomputed every time the base branch moves.
export function statusShaForPullRequest(pullRequestToReport) {
  return pullRequestToReport.head?.sha;
}

function reviewDigest(reviews) {
  return reviews
    .map((review) => (
      `${review.id}:${review.state}:${review.commit_id}:`
      + `${review.submitted_at}:${review.user?.id}:${review.user?.login}`
    ))
    .sort()
    .join('|');
}

function samePullRequestVersion(left, right) {
  return (
    left.state === right.state
    && left.draft === right.draft
    && left.head?.sha === right.head?.sha
    && left.base?.ref === right.base?.ref
    && left.base?.sha === right.base?.sha
    && left.mergeable === right.mergeable
  );
}

async function evaluatePullRequest({
  api,
  owner,
  repo,
  pullRequest: current,
  leads,
  contributors,
  targetUrl,
  attempt = 0,
}) {
  // Re-fetch before evaluating so a delayed workflow_run never trusts its event's
  // old head or merge SHA.
  current = await pullRequest(api, owner, repo, current.number);
  if (current.state !== 'open') {
    return;
  }

  const statusSha = statusShaForPullRequest(current);
  if (current.draft) {
    await setPolicyStatus(
      api,
      owner,
      repo,
      statusSha,
      'pending',
      'Waiting for the pull request to be marked ready for review',
      targetUrl,
    );
    console.log(`PR #${current.number}: draft`);
    return;
  }

  const firstReviews = await reviewsForPullRequest(api, owner, repo, current.number);
  const checked = await pullRequest(api, owner, repo, current.number);
  const secondReviews = await reviewsForPullRequest(api, owner, repo, current.number);
  const live = await pullRequest(api, owner, repo, current.number);
  if (checked.state !== 'open' || live.state !== 'open') {
    return;
  }
  const liveStatusSha = statusShaForPullRequest(live);
  if (
    !samePullRequestVersion(current, checked)
    || !samePullRequestVersion(checked, live)
    || reviewDigest(firstReviews) !== reviewDigest(secondReviews)
    || liveStatusSha !== statusSha
  ) {
    if (attempt >= 1) {
      throw new Error('Pull request changed repeatedly during evaluation.');
    }
    console.log(`PR #${current.number}: changed during evaluation; retrying once`);
    return evaluatePullRequest({
      api,
      owner,
      repo,
      pullRequest: live,
      leads,
      contributors,
      targetUrl,
      attempt: attempt + 1,
    });
  }

  const approved = approvedReviewers(
    secondReviews,
    live.head.sha,
    live.user?.login,
  );
  const result = evaluatePolicy(approved, leads, contributors);
  const state = result.passes ? 'success' : 'pending';
  const description = result.passes
    ? `Passed: ${result.leadApprovals}/1 lead or ${result.contributorApprovals}/2 contributors`
    : `Waiting: ${result.leadApprovals}/1 lead or ${result.contributorApprovals}/2 contributors`;

  await setPolicyStatus(api, owner, repo, liveStatusSha, state, description, targetUrl);
  console.log(
    `PR #${current.number}: lead=${result.leadApprovals}, `
    + `contributors=${result.contributorApprovals}, status=${state}`,
  );
}

async function eventPayload() {
  const payloadPath = process.env.GITHUB_EVENT_PATH;
  if (!payloadPath) {
    return {};
  }
  return JSON.parse(await readFile(payloadPath, 'utf8'));
}

async function pullRequestsToEvaluate(api, owner, repo, eventName, payload) {
  const open = await openPullRequests(api, owner, repo);
  if (eventName === 'workflow_run') {
    // Treat workflow_run fields only as untrusted locators. Match them against
    // live open PRs fetched with the App token before evaluating anything.
    const numbers = new Set(pullRequestNumbersFromWorkflowRun(payload.workflow_run));
    const headSha = payload.workflow_run?.head_sha;
    const linked = open.filter((candidate) => (
      numbers.has(candidate.number)
      || candidate.head?.sha === headSha
      || candidate.merge_commit_sha === headSha
    ));
    return linked.length > 0 ? linked : open;
  }
  return open;
}

export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const { owner, repo } = repositoryParts(repository);
  if (owner !== 'ontrack-features-t2-2026' || !ALLOWED_REPOSITORIES.has(repo)) {
    throw new Error('This evaluator only runs for the three approved OnTrack repositories.');
  }

  const appId = process.env.ONTRACK_REVIEW_APP_ID;
  const privateKey = process.env.ONTRACK_REVIEW_APP_PRIVATE_KEY;
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  const token = await mintInstallationToken({
    apiUrl,
    owner,
    repo,
    appId,
    privateKey,
  });
  const api = new GitHubApi(apiUrl, token);
  const payload = await eventPayload();
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const pullRequests = await pullRequestsToEvaluate(api, owner, repo, eventName, payload);

  if (pullRequests.length === 0) {
    console.log('No open pull requests require review-policy evaluation.');
    return;
  }

  const leadTeam = process.env.ONTRACK_LEAD_TEAM || 'ontrack-leads';
  const contributorTeam = process.env.ONTRACK_CONTRIBUTOR_TEAM || 'ontrack-contributors';
  let leads;
  let contributors;
  try {
    [leads, contributors] = await Promise.all([
      teamMembers(api, owner, leadTeam),
      teamMembers(api, owner, contributorTeam),
    ]);
  } catch (error) {
    const targetUrl = runUrl(repository, process.env.GITHUB_RUN_ID);
    for (const current of pullRequests) {
      try {
        const sha = statusShaForPullRequest(current);
        await setPolicyStatus(
          api,
          owner,
          repo,
          sha,
          'error',
          'OnTrack team membership could not be verified',
          targetUrl,
        );
      } catch (statusError) {
        console.error(`::error::${safeError(statusError)}`);
      }
    }
    throw error;
  }

  const targetUrl = runUrl(repository, process.env.GITHUB_RUN_ID);
  const failures = [];
  for (const current of pullRequests) {
    try {
      await evaluatePullRequest({
        api,
        owner,
        repo,
        pullRequest: current,
        leads,
        contributors,
        targetUrl,
      });
    } catch (error) {
      failures.push(error);
      try {
        const sha = statusShaForPullRequest(current);
        await setPolicyStatus(
          api,
          owner,
          repo,
          sha,
          'error',
          'OnTrack review policy evaluation failed',
          targetUrl,
        );
      } catch (statusError) {
        console.error(`::error::${safeError(statusError)}`);
      }
      console.error(`::error::PR #${current.number}: ${safeError(error)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} pull-request evaluation(s) failed.`);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`::error::${safeError(error)}`);
    process.exitCode = 1;
  });
}
