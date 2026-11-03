import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildEnvironmentUpdates, buildMessage, buildParentMessage, prepareNotification } from './messages.mjs';

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
  status: 'completed',
  conclusion: 'success',
};

test('parent message shows the commit title with run, commit and PR links', () => {
  const parent = buildParentMessage({ run: { ...run, id: 7, head_commit: { message: 'Ship a change (#15571)' } }, channel: 'CDEPLOY' });
  assert.equal(parent.blocks[0].text.text, 'Deploying: Ship a change (#15571)');
  assert.equal(parent.blocks[0].block_id, 'deployment-7-2');
  assert.equal(
    parent.blocks[1].elements[0].text,
    `<${run.html_url}|Workflow run (attempt 2)>  ·  <${run.repository.html_url}/commit/${run.head_sha}|abc1234>  ·  <${run.repository.html_url}/pull/15571|PR #15571>`,
  );
  const first = buildParentMessage({ run: { ...run, run_attempt: 1, head_commit: { message: 'Hotfix' } }, channel: 'CDEPLOY' });
  assert.equal(first.blocks[1].elements[0].text, `<${run.html_url}|Workflow run>  ·  <${run.repository.html_url}/commit/${run.head_sha}|abc1234>`);
});

const completed = { ...run, status: 'completed' };
const environmentText = jobs => buildEnvironmentUpdates({ run: completed, jobs, channel: 'CDEPLOY' }).map(update => update.message.text).join('\n');

test('parent credits the author and includes a different merger', () => {
  const parent = buildParentMessage({ run, channel: 'CDEPLOY', author: 'alice', merger: 'bob' });
  assert.equal(parent.text, 'Deploying: Ship a change\nAuthor: alice  ·  Merged by: bob');
  assert.equal(parent.blocks[0].text.text, parent.text);
  const same = buildParentMessage({ run, channel: 'CDEPLOY', author: 'Alice', merger: 'alice' });
  assert.equal(same.text, 'Deploying: Ship a change\nAuthor: Alice');
});

test('parent falls back to the commit author and escapes attribution', () => {
  const parent = buildParentMessage({
    run: { ...run, head_commit: { message: 'Hotfix', author: { name: 'Alice & <!channel>' } } },
    channel: 'CDEPLOY',
  });
  assert.equal(parent.text, 'Deploying: Hotfix\nAuthor: Alice &amp; &lt;!channel&gt;');
});

test('display names are escaped plain text and do not determine whether the merger is different', () => {
  const parent = buildParentMessage({
    run, channel: 'CDEPLOY', author: 'alice', merger: 'bob',
    authorDisplayName: 'Alex & <@USER>', mergerDisplayName: 'Alex & <@USER>',
  });
  assert.equal(parent.text, 'Deploying: Ship a change\nAuthor: Alex &amp; &lt;@USER&gt;  ·  Merged by: Alex &amp; &lt;@USER&gt;');
  const same = buildParentMessage({
    run, channel: 'CDEPLOY', author: 'Alice', merger: 'alice',
    authorDisplayName: 'Alex', mergerDisplayName: 'Alex',
  });
  assert.equal(same.text, 'Deploying: Ship a change\nAuthor: Alex');
});

test('environment replies link to telemetry and the Render service', () => {
  const text = environmentText([backend]);
  assert.match(text, /Render: :white_check_mark: <[^>]+\|success>/);
  assert.match(text, /Frontend build: not run in this attempt/);
  assert.ok(text.includes('*test*'));
  assert.ok(text.includes("deployment_environment+%3D+%27test%27"));
  assert.ok(text.includes('https://polar-sh.sentry.io/issues/?environment=test'));
  assert.ok(text.includes('since=2026-10-16T08%3A13%3A17Z'));
  const deployWorkflow = readFileSync(new URL('../../workflows/deploy.yml', import.meta.url), 'utf8');
  const section = deployWorkflow.split('  deploy-test:')[1].split('\n  deploy-')[0];
  const service = section.match(/render-api-service-id: "([^"]+)"/)[1];
  assert.ok(text.includes(`https://dashboard.render.com/web/${service}`));
});

test('the final reply is only the outcome, plus failed jobs when there are any', () => {
  const success = buildMessage({ ...input, jobs: [backend] });
  assert.equal(success.text, '*Deployment run: success*');
  assert.equal(success.channel, 'CDEPLOY');
  assert.equal(success.unfurl_links, false);
  const failure = buildMessage({
    ...input,
    run: { ...run, conclusion: 'failure' },
    jobs: [
      { ...backend, conclusion: 'failure' },
      { ...backend, name: 'Build Lambda Worker Image (ECR) λ', conclusion: 'timed_out' },
      { ...backend, name: 'Deploy to Production 🚀 / Backend: Deploy to production' },
    ],
  });
  assert.match(failure.text, /^\*Deployment run: failure\*\n\n\*Failed jobs\*\n/);
  assert.match(failure.text, /Backend: Deploy to test>: failure/);
  assert.match(failure.text, /Build Lambda Worker Image \(ECR\) λ>: timed_out/);
  assert.doesNotMatch(failure.text, /production>/);
  const cancelled = buildMessage({ ...input, run: { ...run, conclusion: 'cancelled' }, jobs: [{ ...backend, conclusion: 'cancelled' }] });
  assert.equal(cancelled.text, '*Deployment run: cancelled*');
});

test('environment replies distinguish skipped, failed, cancelled and unknown components', () => {
  const text = environmentText([
    { ...backend, conclusion: 'skipped' },
    { ...backend, name: 'Deploy to Test 🧰 / Frontend: Build' },
    { ...backend, name: 'Deploy to Test 🧰 / Frontend: Promote to Production', conclusion: 'failure' },
    { ...backend, name: 'Deploy Lambda Worker to Test 🧰', conclusion: 'cancelled' },
  ]);
  assert.match(text, /Render: :fast_forward: <[^>]+\|skipped>/);
  assert.match(text, /Frontend build: :white_check_mark:/);
  assert.match(text, /Frontend promotion: :x:/);
  assert.match(text, /Lambda update request: :no_entry_sign:/);
  assert.match(environmentText([{ ...backend, conclusion: null }]), /Render: :grey_question: <[^>]+\|unknown>/);
});

test('production reports the frontend build that runs before the production deploy', () => {
  const deployWorkflow = readFileSync(new URL('../../workflows/deploy.yml', import.meta.url), 'utf8');
  const buildName = deployWorkflow.match(/\n  build-production-frontend:\n    name: "([^"]+)"/)[1];
  const text = environmentText([
    { ...backend, name: buildName },
    { ...backend, name: 'Deploy to Production 🚀 / Frontend: Build', conclusion: 'skipped' },
    { ...backend, name: 'Deploy to Production 🚀 / Backend: Deploy to production' },
    { ...backend, name: 'Deploy to Production 🚀 / Frontend: Promote to Production' },
    { ...backend, name: 'Deploy Lambda Worker to Production 🚀' },
  ]);
  assert.match(text, /\*production\*\nRender: :white_check_mark: .* Frontend build: :white_check_mark:/);
});

test('escapes job names and conclusions in the failed jobs list', () => {
  const message = buildMessage({
    ...input,
    run: { ...run, conclusion: 'failure' },
    jobs: [{ ...backend, name: 'Deploy <!channel> & co', conclusion: 'failure' }],
  });
  assert.ok(message.text.includes('Deploy &lt;!channel&gt; &amp; co>: failure'));
  assert.doesNotMatch(message.text, /<!channel>/);
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
  assert.match(message.text, /Backend: Deploy to test>: failure/);
  assert.match(summary, /\[Deploy to Test 🧰 \/ Backend: Deploy to test\]\(https:\/\/github.com\//);
  assert.deepEqual(warnings, ['Could not look up head commit PRs: PR lookup unavailable']);
});
