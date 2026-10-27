import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnvironmentUpdates, buildParentMessage } from './messages.mjs';
import { postEnvironmentUpdates, watchDeployment } from './progress.mjs';
import { notifyDeployment } from './slack.mjs';

process.env.DEPLOY_SLACK_CHANNEL_ID = 'CDEPLOY';
const run = {
  id: 123, run_number: 42, run_attempt: 2, status: 'in_progress',
  html_url: 'https://github.com/polarsource/polar/actions/runs/123',
  repository: { html_url: 'https://github.com/polarsource/polar' },
  head_sha: 'abc123456', head_branch: 'main', actor: { login: 'deployer', type: 'User' },
  run_started_at: '2026-10-16T12:00:00Z',
};
const repo = { owner: 'polarsource', repo: 'polar' };
const jobs = ['test', 'sandbox', 'production'].flatMap(environment => {
  const name = environment[0].toUpperCase() + environment.slice(1);
  return [
    `Deploy to ${name} 🚀 / Backend: Deploy to ${environment}`,
    `Deploy to ${name} 🚀 / Frontend: Build`,
    `Deploy to ${name} 🚀 / Frontend: Promote to Production`,
    `Deploy Lambda Worker to ${name} 🚀`,
  ].map(name => ({ name, html_url: `${run.html_url}/job/1`, status: 'completed', conclusion: 'success' }));
});

test('posts each environment into the original thread before the run ends, without repeats on completion or retry', async () => {
  let poll = 0;
  const snapshots = [
    jobs.slice(0, 3),
    jobs.slice(0, 4),
    jobs.slice(0, 8),
    jobs,
  ];
  const messages = [];
  const reactions = [];
  const github = {
    rest: {
      actions: {
        listJobsForWorkflowRunAttempt: 'jobs',
        getWorkflowRunAttempt: async parameters => {
          assert.equal(parameters.run_id, run.id);
          assert.equal(parameters.attempt_number, 2);
          return { data: { ...run, status: poll === 3 ? 'completed' : 'in_progress' } };
        },
      },
      repos: { listPullRequestsAssociatedWithCommit: 'prs' },
    },
    paginate: async (endpoint, parameters) => {
      if (endpoint === 'prs') return [];
      assert.equal(parameters.attempt_number, 2);
      return snapshots[poll];
    },
  };
  const slack = async (method, payload) => {
    if (method === 'auth.test') return { user_id: 'BOT' };
    if (method === 'conversations.history') return { messages: messages.filter(message => !message.thread_ts) };
    if (method === 'conversations.replies') return { messages };
    if (method === 'chat.postMessage') {
      const ts = String(messages.length + 1);
      messages.push({ ...structuredClone(payload), ts, user: 'BOT' });
      return { ts };
    }
    if (method === 'chat.update') {
      Object.assign(messages.find(message => message.ts === payload.ts), structuredClone(payload));
      return { ok: true };
    }
    if (method === 'reactions.add') { reactions.push(payload); return { ok: true }; }
    assert.fail(`Unexpected Slack method: ${method}`);
  };
  const core = { warning: assert.fail, setFailed: assert.fail, summary: { addRaw: () => ({ write: async () => {} }) } };
  const context = { repo, payload: { action: 'in_progress', workflow_run: run } };
  await notifyDeployment({ github, slack, core, context });
  const parentPayload = buildParentMessage({ run, channel: 'CDEPLOY' });
  const parent = structuredClone(messages[0]);
  await watchDeployment({
    github, context, core, slack, botUser: 'BOT', parent, parentPayload,
    sleep: async milliseconds => {
      assert.equal(milliseconds, 30_000);
      assert.equal(messages.length, poll + 1);
      assert.ok(messages.slice(1).every(message => message.thread_ts === parent.ts));
      poll++;
    },
  });
  assert.equal(messages.length, 4);
  assert.deepEqual(messages.slice(1).map(message => message.text.split('\n')[0]), ['*test*', '*sandbox*', '*production*']);
  assert.ok(messages.slice(1).every(message => message.thread_ts === parent.ts));
  await notifyDeployment({ github, slack, core, context, watch: true });
  assert.equal(messages.length, 4);
  context.payload = { action: 'completed', workflow_run: { ...run, status: 'completed', conclusion: 'success' } };
  await notifyDeployment({ github, slack, core, context });
  await notifyDeployment({ github, slack, core, context });
  assert.equal(messages.length, 5);
  assert.equal(messages[4].thread_ts, parent.ts);
  assert.match(messages[4].text, /Deployment run: success/);
  assert.ok(reactions.length > 0);
  assert.ok(reactions.every(reaction => reaction.timestamp === parent.ts));
  assert.deepEqual(reactions.map(reaction => reaction.name).filter(name => name !== 'white_check_mark'), ['baby_chick', 'child', 'older_woman']);
  await notifyDeployment({ github: {}, slack, core, context: { repo, payload: { action: 'in_progress', workflow_run: run } }, watch: true });
  assert.equal(messages.length, 5);
});

test('waits for frontend promotion and Lambda, and reports skipped, failed and cancelled components accurately', () => {
  for (const state of ['queued', 'in_progress']) {
    for (const index of [2, 3]) {
      const pending = jobs.slice(0, 4).map((job, i) => i === index ? { ...job, status: state, conclusion: null } : job);
      assert.deepEqual(buildEnvironmentUpdates({ run, jobs: pending }), []);
    }
  }
  for (const conclusion of ['skipped', 'failure', 'cancelled']) {
    const finished = jobs.slice(0, 4).map(job => ({ ...job, conclusion }));
    finished[0].name = 'Deploy to Test 🧰 / Backend: Deploy to ${{ inputs.environment }}';
    const updates = buildEnvironmentUpdates({ run, jobs: finished });
    assert.equal(updates.length, 1);
    assert.match(updates[0].message.text, new RegExp(`Render: .*\\|${conclusion}>`));
    assert.doesNotMatch(updates[0].message.text, /white_check_mark/);
    assert.equal(updates[0].succeeded, false);
  }
  const frontendOnly = jobs.slice(0, 4).map((job, i) => i === 0 || i === 3 ? { ...job, conclusion: 'skipped' } : job);
  assert.equal(buildEnvironmentUpdates({ run, jobs: frontendOnly })[0].succeeded, true);
  assert.deepEqual(buildEnvironmentUpdates({ run, jobs: [jobs[0]] }), []);
  const [partial] = buildEnvironmentUpdates({ run: { ...run, status: 'completed' }, jobs: [jobs[0]] });
  assert.match(partial.message.text, /Frontend promotion: not run in this attempt/);
});

test('a missed start event is recovered with environment replies and the final summary in one thread', async () => {
  const posts = [];
  await notifyDeployment({
    context: { repo, payload: { action: 'completed', workflow_run: { ...run, status: 'completed', conclusion: 'success' } } },
    core: { warning: assert.fail, setFailed: assert.fail, summary: { addRaw: () => ({ write: async () => {} }) } },
    github: {
      rest: { actions: { listJobsForWorkflowRunAttempt: 'jobs' }, repos: { listPullRequestsAssociatedWithCommit: 'prs' } },
      paginate: async endpoint => endpoint === 'jobs' ? jobs : [],
    },
    slack: async (method, payload) => {
      if (method === 'auth.test') return { user_id: 'BOT' };
      if (method === 'conversations.history') return { messages: [] };
      if (method === 'conversations.replies') return { messages: posts };
      if (method === 'chat.postMessage') { posts.push(payload); return { ts: 'parent' }; }
      assert.ok(['chat.update', 'reactions.add'].includes(method));
      return { ok: true };
    },
  });
  assert.equal(posts.length, 5);
  assert.equal(posts[0].thread_ts, undefined);
  assert.ok(posts.slice(1).every(post => post.thread_ts === 'parent'));
  assert.match(posts[4].text, /Deployment run: success/);
});

test('stops polling within the observer time budget and leaves completion handling available', async () => {
  let time = 0;
  const warnings = [];
  const parentPayload = buildParentMessage({ run, channel: 'CDEPLOY' });
  await watchDeployment({
    context: { repo, payload: { workflow_run: run } },
    core: { warning: message => warnings.push(message) },
    parent: { ts: '1' }, parentPayload, slack: assert.fail,
    github: {
      rest: { actions: { getWorkflowRunAttempt: async () => ({ data: run }), listJobsForWorkflowRunAttempt: 'jobs' } },
      paginate: async () => [],
    },
    now: () => time,
    sleep: async () => { time += 350 * 60_000; },
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /completion event will still post/);
});

test('retry after a failed parent update reuses the environment reply and repairs the marker', async () => {
  const parentPayload = buildParentMessage({ run, channel: 'CDEPLOY' });
  const parent = { ...structuredClone(parentPayload), ts: 'parent' };
  const messages = [];
  const reactions = [];
  let updates = 0;
  const slack = async (method, payload) => {
    if (method === 'conversations.replies') return { messages };
    if (method === 'chat.postMessage') {
      messages.push({ ...structuredClone(payload), ts: 'reply', user: 'BOT' });
      return { ts: 'reply' };
    }
    if (method === 'reactions.add') { reactions.push(payload); return { ok: true }; }
    assert.equal(method, 'chat.update');
    if (++updates === 1) throw new Error('parent update failed');
    Object.assign(parent, structuredClone(payload));
    return { ok: true };
  };
  const args = { run, jobs: jobs.slice(0, 4), slack, parentPayload, botUser: 'BOT' };
  await assert.rejects(postEnvironmentUpdates({ ...args, parent: structuredClone(parent) }), /parent update failed/);
  await postEnvironmentUpdates({ ...args, parent: structuredClone(parent) });
  await postEnvironmentUpdates({ ...args, parent: structuredClone(parent) });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].thread_ts, parent.ts);
  assert.deepEqual(reactions, Array(2).fill({ channel: 'CDEPLOY', timestamp: 'parent', name: 'baby_chick' }));
  assert.match(parent.blocks[0].block_id, /-progress-test$/);
});
