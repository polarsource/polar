import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildMessage, prepareNotification } from './messages.mjs';

const run = {
  conclusion: 'success',
  html_url: 'https://github.com/polarsource/polar/actions/runs/123',
  run_number: 42,
  run_attempt: 2,
  head_sha: 'abc1234567890',
  head_branch: 'main',
  actor: { login: 'deployer' },
  head_commit: { message: 'Ship a change\nMore detail' },
  repository: { html_url: 'https://github.com/polarsource/polar' },
  run_started_at: '2026-10-16T08:13:17Z',
};
const input = { run, jobs: [], pullRequests: [], channel: 'CDEPLOY' };
const backend = {
  name: 'Deploy to Test 🧰 / Backend: Deploy to test',
  html_url: `${run.html_url}/job/456`,
  conclusion: 'success',
};

test('reports each environment and links to its telemetry and Render service', () => {
  const message = buildMessage({ ...input, jobs: [backend] });
  assert.equal(message.channel, 'CDEPLOY');
  assert.match(message.text, /Run #42, attempt 2/);
  assert.match(message.text, /Render: :white_check_mark: <[^>]+\|success>/);
  assert.match(message.text, /Frontend build: not run in this attempt/);
  const deployWorkflow = readFileSync(new URL('../../workflows/deploy.yml', import.meta.url), 'utf8');
  for (const environment of ['production', 'sandbox', 'test']) {
    assert.ok(message.text.includes(`*${environment}*`));
    assert.ok(message.text.includes(`deployment_environment+%3D+%27${environment}%27`));
    assert.ok(message.text.includes(`https://polar-sh.sentry.io/issues/?environment=${environment}`));
    const section = deployWorkflow.split(`  deploy-${environment}:`)[1].split('\n  deploy-')[0];
    const service = section.match(/render-api-service-id: "([^"]+)"/)[1];
    assert.ok(message.text.includes(`https://dashboard.render.com/web/${service}`));
  }
  assert.ok(message.text.includes('since=2026-10-16T08%3A13%3A17Z'));
  assert.equal(message.unfurl_links, false);
});

test('reports test, Lambda and build failures even when production succeeds', () => {
  const message = buildMessage({
    ...input,
    run: { ...run, conclusion: 'failure' },
    jobs: [
      { ...backend, conclusion: 'failure' },
      { ...backend, name: 'Deploy Lambda Worker to Sandbox 🧪', conclusion: 'failure' },
      { ...backend, name: 'Build Lambda Worker Image (ECR) λ', conclusion: 'timed_out' },
      { ...backend, name: 'Deploy to Production 🚀 / Backend: Deploy to production' },
    ],
  });
  assert.match(message.text, /Deployment run: failure/);
  assert.match(message.text, /Lambda update request: :x:/);
  assert.match(message.text, /\*Failed jobs\*[\s\S]*Backend: Deploy to test/);
  assert.match(message.text, /Build Lambda Worker Image \(ECR\) λ>: timed_out/);
});

test('distinguishes a built frontend from a failed promotion and skipped backend', () => {
  const message = buildMessage({
    ...input,
    jobs: [
      { ...backend, conclusion: 'skipped' },
      { ...backend, name: 'Deploy to Test 🧰 / Frontend: Build' },
      { ...backend, name: 'Deploy to Test 🧰 / Frontend: Promote to Production', conclusion: 'failure' },
    ],
  });
  assert.match(message.text, /Render: :fast_forward: <[^>]+\|skipped>/);
  assert.match(message.text, /Frontend build: :white_check_mark:/);
  assert.match(message.text, /Frontend promotion: :x:/);
});

test('reports cancellations and unknown outcomes without claiming success', () => {
  const message = buildMessage({
    ...input,
    run: { ...run, conclusion: 'cancelled' },
    jobs: [{ ...backend, conclusion: 'cancelled' }],
  });
  assert.match(message.text, /Deployment run: cancelled/);
  assert.match(message.text, /Render: :no_entry_sign:/);
  assert.doesNotMatch(message.text, /white_check_mark/);
  const unknown = buildMessage({ ...input, jobs: [{ ...backend, conclusion: null }] });
  assert.match(unknown.text, /Render: :grey_question: <[^>]+\|unknown>/);
});

test('escapes commit text and branch names and links the head commit PR', () => {
  const message = buildMessage({
    ...input,
    run: { ...run, head_commit: { message: 'Fix <!channel> & <https://example.com|fake>\nignored' }, head_branch: '<!here>' },
    pullRequests: [{ number: 123, html_url: 'https://github.com/polarsource/polar/pull/123' }],
  });
  assert.ok(message.text.includes('&lt;!channel&gt; &amp; &lt;https://example.com|fake&gt;'));
  assert.ok(message.text.includes('&lt;!here&gt;'));
  assert.doesNotMatch(message.text, /ignored|<!channel>|<!here>/);
  assert.match(message.text, /Head commit PR: <https:\/\/github.com\/polarsource\/polar\/pull\/123\|#123>/);
});

test('uses the completed attempt and still prepares a notification if PR lookup fails', async () => {
  let summary;
  const warnings = [];
  const github = {
    rest: {
      actions: { listJobsForWorkflowRunAttempt: 'attempt-jobs' },
      repos: { listPullRequestsAssociatedWithCommit: 'commit-prs' },
    },
    async paginate(endpoint, parameters) {
      if (endpoint === 'commit-prs') throw new Error('PR lookup unavailable');
      assert.equal(endpoint, 'attempt-jobs');
      assert.equal(parameters.attempt_number, 2);
      assert.equal(parameters.run_id, 123);
      return [{ ...backend, conclusion: 'failure' }];
    },
  };
  const { message } = await prepareNotification({
    github,
    context: { repo: { owner: 'polarsource', repo: 'polar' }, payload: { workflow_run: { ...run, id: 123, conclusion: 'failure' } } },
    core: {
      warning: message => warnings.push(message),
      summary: { addRaw: text => ({ write: async () => { summary = text; } }) },
    },
  });
  assert.match(message.text, /Deployment run: failure/);
  assert.match(message.text, /Render: :x:/);
  assert.match(summary, /\[failure\]\(https:\/\/github.com\//);
  assert.deepEqual(warnings, ['Could not look up head commit PRs: PR lookup unavailable']);
});
