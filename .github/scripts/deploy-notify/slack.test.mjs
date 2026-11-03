import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildParentMessage } from './messages.mjs';
import { notifyDeployment, slackClient } from './slack.mjs';

process.env.DEPLOY_SLACK_CHANNEL_ID = 'CDEPLOY';
process.env.SLACK_USERS_JSON = JSON.stringify({ deployer: 'UTESTDEPLOYER', author: 'UAUTHOR', merger: 'UMERGER' });
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

for (const attempt of [
  { event: 'push', run_attempt: 1 },
  { event: 'workflow_dispatch', run_attempt: 1 },
  { event: 'push', run_attempt: 2 },
]) {
  test(`parent credits PR author and merger through completion (${attempt.event}, attempt ${attempt.run_attempt})`, async () => {
    const messages = [];
    const deployment = {
      ...run, ...attempt,
      head_commit: { message: 'Ship a change', author: { name: 'Commit Author' } },
    };
    const slack = async (method, payload) => {
      if (method === 'auth.test') return { user_id: 'BOT' };
      if (method === 'users.info') {
        assert.ok(['UAUTHOR', 'UMERGER'].includes(payload.user));
        return { user: { profile: { display_name: payload.user === 'UAUTHOR' ? 'Alex Author' : 'Morgan Merger' } } };
      }
      if (method === 'conversations.history' || method === 'conversations.replies') return { messages };
      if (method === 'chat.postMessage') {
        const ts = String(messages.length + 1);
        messages.push({ ...structuredClone(payload), user: 'BOT', ts });
        return { ts };
      }
      if (method === 'chat.update') {
        Object.assign(messages.find(message => message.ts === payload.ts), payload);
        return { ok: true };
      }
      if (method === 'reactions.add') return { ok: true };
      assert.fail(`Unexpected Slack method: ${method}`);
    };
    const args = {
      github: {
        ...github,
        async paginate(endpoint) {
          if (endpoint === 'jobs') return [{
            name: 'Deploy to Test 🧰 / Backend: Deploy to test',
            status: 'completed', conclusion: 'success', html_url: `${run.html_url}/job/456`,
          }];
          return [
            { number: 1, merged_at: '2026-10-16T11:00:00Z', base: { ref: 'main' }, merge_commit_sha: 'other', user: { login: 'unrelated' } },
            { number: 42, merged_at: '2026-10-16T12:00:00Z', base: { ref: 'main' }, merge_commit_sha: run.head_sha, user: { login: 'author' } },
          ];
        },
        async graphql(query, parameters) {
          assert.equal(parameters.number, 42);
          return { repository: { pullRequest: { mergedBy: { login: 'merger', __typename: 'User' } } } };
        },
      },
      slack,
      context: { repo, payload: { action: 'in_progress', workflow_run: deployment } },
      core: { warning: assert.fail, summary: { addRaw: () => ({ write: async () => {} }) } },
    };
    await notifyDeployment(args);
    assert.equal(messages[0].text, 'Deploying: Ship a change\nAuthor: Alex Author  ·  Merged by: Morgan Merger');
    args.context.payload = { action: 'completed', workflow_run: { ...deployment, status: 'completed', conclusion: 'success' } };
    await notifyDeployment(args);
    assert.equal(messages[0].text, 'Deploying: Ship a change\nAuthor: Alex Author  ·  Merged by: Morgan Merger');
    assert.equal(messages[0].blocks[0].text.text, messages[0].text);
    assert.equal(messages[0].blocks[0].block_id, `deployment-123-${attempt.run_attempt}-completed`);
  });
}

for (const scenario of [
  { name: 'mapped user', login: 'Deployer', profile: { display_name: '  Alex  ' }, expected: 'Alex', lookups: 1 },
  { name: 'unmapped user', login: 'unmapped', expected: 'unmapped', lookups: 0 },
  { name: 'empty display name', login: 'Deployer', profile: { display_name: '  ' }, expected: 'Deployer', lookups: 1 },
  { name: 'missing profile', login: 'Deployer', expected: 'Deployer', lookups: 1 },
  { name: 'lookup failure', login: 'Deployer', error: 'missing_scope', expected: 'Deployer', lookups: 1 },
]) {
  test(`initial attribution uses plain display names or GitHub fallback: ${scenario.name}`, async () => {
    const posts = [];
    const warnings = [];
    let lookups = 0;
    await notifyDeployment({
      github: {
        ...github,
        paginate: async () => [{
          number: 42, merged_at: '2026-10-16T12:00:00Z', base: { ref: 'main' },
          merge_commit_sha: run.head_sha, user: { login: scenario.login },
        }],
        graphql: async () => ({ repository: { pullRequest: {
          mergedBy: { login: scenario.login.toLowerCase(), __typename: 'User' },
        } } }),
      },
      context: { repo, payload: { action: 'in_progress', workflow_run: run } },
      core: { warning: message => warnings.push(message) },
      slack: async (method, payload) => {
        if (method === 'auth.test') return { user_id: 'BOT' };
        if (method === 'conversations.history') return { messages: [] };
        if (method === 'users.info') {
          lookups++;
          assert.equal(payload.user, 'UTESTDEPLOYER');
          if (scenario.error) throw new Error(scenario.error);
          return { user: { profile: scenario.profile } };
        }
        assert.equal(method, 'chat.postMessage');
        posts.push(payload);
        return { ts: '1' };
      },
    });
    assert.equal(posts[0].text, `Deploying: Ship a change\nAuthor: ${scenario.expected}`);
    assert.equal(posts[0].blocks[0].text.text, posts[0].text);
    assert.doesNotMatch(JSON.stringify(posts[0]), /<@/);
    assert.equal(lookups, scenario.lookups);
    assert.deepEqual(warnings, scenario.error
      ? [`Could not look up Slack display name for Deployer: ${scenario.error}`]
      : []);
  });
}

test('PR lookup failure still posts the initial message with the commit author', async () => {
  const posts = [];
  const warnings = [];
  await notifyDeployment({
    github: { ...github, paginate: async () => { throw new Error('GitHub unavailable'); } },
    context: { repo, payload: { action: 'in_progress', workflow_run: {
      ...run, head_commit: { message: 'Hotfix', author: { name: 'Alice' } },
    } } },
    core: { warning: message => warnings.push(message) },
    slack: async (method, payload) => {
      if (method === 'auth.test') return { user_id: 'BOT' };
      if (method === 'conversations.history') return { messages: [] };
      assert.equal(method, 'chat.postMessage');
      posts.push(payload);
      return { ts: '1' };
    },
  });
  assert.equal(posts[0].text, 'Deploying: Hotfix\nAuthor: Alice');
  assert.deepEqual(warnings, ['Could not look up head commit PRs: GitHub unavailable']);
});

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

test('Slack reads send user, thread and pagination arguments as GET query parameters', async () => {
  const requests = [];
  const slack = slackClient('test-token', async (url, options) => {
    requests.push({ url: new URL(url), options });
    return { ok: true, json: async () => ({ ok: true, messages: [] }) };
  });
  const payloads = {
    'users.info': { user: 'UAUTHOR' },
    'conversations.history': { channel: 'CDEPLOY', oldest: '1792152000.000001', limit: 100 },
    'conversations.replies': {
      channel: 'CDEPLOY', ts: '1792152000.000001', limit: 100,
      include_all_metadata: true, cursor: 'next+page/=',
    },
  };
  for (const [method, payload] of Object.entries(payloads)) {
    await slack(method, payload);
    const { url, options } = requests.at(-1);
    assert.equal(url.pathname, `/api/${method}`);
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(Object.fromEntries(url.searchParams),
      Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value)])));
  }
});

test('Slack message writes preserve JSON metadata and expose validation errors', async () => {
  const payload = {
    channel: 'CDEPLOY', thread_ts: '1792152000.000001', text: 'Deployed',
    metadata: { event_type: 'polar_deployment_reply', event_payload: { id: 'deployment-123-1' } },
  };
  const slack = slackClient('test-token', async (url, options) => {
    assert.equal(String(url), 'https://slack.com/api/chat.postMessage');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), payload);
    return { ok: true, json: async () => ({
      ok: false, error: 'invalid_arguments',
      response_metadata: { messages: ['[ERROR] missing required field: ts'] },
    }) };
  });
  await assert.rejects(slack('chat.postMessage', payload), /invalid_arguments.*missing required field: ts/);
});
