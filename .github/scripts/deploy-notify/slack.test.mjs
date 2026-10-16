import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildParentMessage } from './messages.mjs';
import { notifyDeployment, slackClient } from './slack.mjs';

process.env.DEPLOY_SLACK_CHANNEL_ID = 'CDEPLOY';
process.env.SLACK_USERS_JSON = JSON.stringify({ deployer: 'UTESTDEPLOYER' });
const run = {
  id: 123, run_number: 42, run_attempt: 1, event: 'workflow_dispatch',
  html_url: 'https://github.com/polarsource/polar/actions/runs/123',
  repository: { html_url: 'https://github.com/polarsource/polar' },
  head_sha: 'abc123456', head_branch: 'main', head_commit: { message: 'Ship a change' },
  actor: { login: 'Deployer', type: 'User' }, run_started_at: '2026-10-16T12:00:00Z',
};
const github = {
  rest: { actions: { listJobsForWorkflowRunAttempt: 'jobs' }, repos: { listPullRequestsAssociatedWithCommit: 'prs' } },
  paginate: async () => [],
};
const repo = { owner: 'polarsource', repo: 'polar' };

for (const [conclusion, reaction] of [['success', 'white_check_mark'], ['failure', 'x'], ['cancelled', 'no_entry_sign']]) {
  test(`${conclusion}: one thread, a final reaction, and only failure mentions the deployer`, async t => {
    const messages = [{ ...buildParentMessage({ run, channel: 'CDEPLOY' }), user: 'OTHER', ts: '1' }];
    const reactions = [];
    const slack = t.mock.fn(async (method, payload) => {
      if (method === 'auth.test') return { user_id: 'BOT' };
      if (method === 'conversations.history') return { messages: messages.filter(message => !message.thread_ts) };
      if (method === 'conversations.replies') return { messages };
      if (method === 'chat.postMessage') {
        const ts = String(messages.length + 1);
        messages.push({ ...payload, user: 'BOT', ts });
        return { ts };
      }
      if (method === 'chat.update') {
        Object.assign(messages.find(message => message.ts === payload.ts), payload);
        return { ok: true };
      }
      if (method === 'reactions.add') {
        reactions.push(payload);
        return { ok: true };
      }
      assert.fail(`Unexpected Slack method: ${method}`);
    });
    const failures = [];
    const core = {
      summary: { addRaw: () => ({ write: async () => {} }) },
      warning: assert.fail,
      setFailed: message => failures.push(message),
    };
    const context = { repo, payload: { action: 'in_progress', workflow_run: run } };
    await notifyDeployment({ github, context, core, slack });
    await notifyDeployment({ github, context, core, slack });
    assert.equal(messages.filter(message => message.user === 'BOT').length, 1);
    context.payload = { action: 'completed', workflow_run: { ...run, conclusion } };
    await notifyDeployment({ github, context, core, slack });
    await notifyDeployment({ github, context, core, slack });
    context.payload.action = 'in_progress';
    await notifyDeployment({ github, context, core, slack });
    const sent = messages.filter(message => message.user === 'BOT');
    assert.equal(sent.length, 2);
    assert.equal(sent[1].thread_ts, sent[0].ts);
    assert.equal(sent[1].text.includes('<@UTESTDEPLOYER>'), conclusion === 'failure');
    assert.ok(reactions.length > 0);
    assert.ok(reactions.every(item => item.name === reaction && item.timestamp === sent[0].ts));
    assert.deepEqual(failures, []);
    context.payload = { action: 'in_progress', workflow_run: { ...run, run_attempt: 2 } };
    await notifyDeployment({ github, context, core, slack });
    assert.equal(messages.filter(message => message.user === 'BOT' && !message.thread_ts).length, 2);
  });
}

test('completion creates a missing parent, and reaction retry does not repeat the failure ping', async t => {
  const messages = [];
  let reactionAttempts = 0;
  const slack = t.mock.fn(async (method, payload) => {
    if (method === 'auth.test') return { user_id: 'BOT' };
    if (method === 'conversations.history') return { messages: messages.filter(message => !message.thread_ts) };
    if (method === 'conversations.replies') return { messages };
    if (method === 'chat.postMessage') {
      const ts = String(messages.length + 1);
      messages.push({ ...payload, user: 'BOT', ts });
      return { ts };
    }
    if (method === 'chat.update') {
      Object.assign(messages.find(message => message.ts === payload.ts), payload);
      return { ok: true };
    }
    if (method === 'reactions.add') {
      if (++reactionAttempts === 1) throw new Error('Slack unavailable');
      return { ok: true };
    }
    assert.fail(`Unexpected Slack method: ${method}`);
  });
  const args = {
    github, slack,
    context: { repo, payload: { action: 'completed', workflow_run: { ...run, conclusion: 'failure' } } },
    core: { summary: { addRaw: () => ({ write: async () => {} }) }, warning: assert.fail, setFailed: assert.fail },
  };
  await assert.rejects(notifyDeployment(args), /Slack unavailable/);
  await notifyDeployment(args);
  assert.equal(messages.length, 2);
  assert.equal(messages.filter(message => message.text.includes('<@UTESTDEPLOYER>')).length, 1);
  assert.equal(reactionAttempts, 2);
});

test('retry after a failed parent update reuses the final reply and does not ping twice', async () => {
  const messages = [];
  const reactions = [];
  let updates = 0;
  const slack = async (method, payload) => {
    if (method === 'auth.test') return { user_id: 'BOT' };
    if (method === 'conversations.history') return { messages: messages.filter(message => !message.thread_ts) };
    if (method === 'conversations.replies') return { messages };
    if (method === 'chat.postMessage') {
      const ts = String(messages.length + 1);
      messages.push({ ...structuredClone(payload), user: 'BOT', ts });
      return { ts };
    }
    if (method === 'chat.update') {
      if (++updates === 1) throw new Error('parent update failed');
      Object.assign(messages.find(message => message.ts === payload.ts), structuredClone(payload));
      return { ok: true };
    }
    if (method === 'reactions.add') { reactions.push(payload); return { ok: true }; }
    assert.fail(`Unexpected Slack method: ${method}`);
  };
  const args = {
    github, slack,
    context: { repo, payload: { action: 'completed', workflow_run: { ...run, conclusion: 'failure' } } },
    core: { summary: { addRaw: () => ({ write: async () => {} }) }, warning: assert.fail, setFailed: assert.fail },
  };
  await assert.rejects(notifyDeployment(args), /parent update failed/);
  await notifyDeployment(args);
  assert.equal(messages.length, 2);
  assert.equal(messages.filter(message => message.text.includes('<@UTESTDEPLOYER>')).length, 1);
  assert.equal(messages[1].thread_ts, messages[0].ts);
  assert.deepEqual(reactions, [{ channel: 'CDEPLOY', timestamp: messages[0].ts, name: 'x' }]);
});

test('searches subsequent history pages and refuses to create a parent when history is unavailable', async t => {
  const parent = { ...buildParentMessage({ run, channel: 'CDEPLOY' }), user: 'BOT', ts: '1' };
  const slack = t.mock.fn(async (method, payload) => {
    if (method === 'auth.test') return { user_id: 'BOT' };
    assert.equal(method, 'conversations.history');
    if (!payload.cursor) return { messages: [], response_metadata: { next_cursor: 'next-page' } };
    assert.equal(payload.cursor, 'next-page');
    return { messages: [parent] };
  });
  const args = { github, core: {}, slack, context: { repo, payload: { action: 'in_progress', workflow_run: run } } };
  await notifyDeployment(args);
  assert.equal(slack.mock.calls.length, 3);
  await assert.rejects(notifyDeployment({ ...args, slack: async method => {
    if (method === 'auth.test') return { user_id: 'BOT' };
    assert.equal(method, 'conversations.history');
    throw new Error('missing_scope');
  } }), /missing_scope/);
});

test('an unknown Slack identity still reports the failure and surfaces the missing ping', async t => {
  const posts = [];
  const failures = [];
  const slack = t.mock.fn(async (method, payload) => {
    if (method === 'auth.test') return { user_id: 'BOT' };
    if (method === 'conversations.history') return { messages: [] };
    if (method === 'conversations.replies') return { messages: [] };
    if (method === 'chat.postMessage') { posts.push(payload); return { ts: '1' }; }
    assert.equal(method, 'reactions.add');
    assert.equal(payload.name, 'x');
    return { ok: true };
  });
  await notifyDeployment({
    github, slack,
    context: { repo, payload: { action: 'completed', workflow_run: {
      ...run, conclusion: 'failure', actor: { login: 'unmapped-user', type: 'User' },
    } } },
    core: {
      summary: { addRaw: () => ({ write: async () => {} }) }, warning: assert.fail,
      setFailed: message => failures.push(message),
    },
  });
  assert.match(posts[1].text, /No Slack ID for GitHub user unmapped-user/);
  assert.doesNotMatch(posts[1].text, /<@/);
  assert.equal(failures.length, 1);
});

test('Slack API errors fail notification; an existing reaction is safe to retry', async () => {
  const denied = slackClient('test-token', async () => ({ ok: true, json: async () => ({ ok: false, error: 'missing_scope' }) }));
  await assert.rejects(denied('chat.postMessage'), /Slack chat.postMessage: missing_scope/);
  const existing = slackClient('test-token', async () => ({ ok: true, json: async () => ({ ok: false, error: 'already_reacted' }) }));
  await existing('reactions.add');
  await assert.rejects(existing('chat.postMessage'), /already_reacted/);
});
