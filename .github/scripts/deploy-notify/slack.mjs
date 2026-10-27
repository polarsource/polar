import { setTimeout } from 'node:timers/promises';
import { buildParentMessage, getPullRequests, prepareNotification } from './messages.mjs';
import { resolveDeployer, resolveMerger } from './deployer.mjs';
import { postEnvironmentUpdates, watchDeployment } from './progress.mjs';
import { postReplyOnce } from './replies.mjs';

export function slackClient(token, fetchResponse = fetch) {
  return async (method, payload = {}) => {
    const read = ['conversations.history', 'conversations.replies', 'users.info'].includes(method);
    const url = new URL(`https://slack.com/api/${method}`);
    if (read) url.search = new URLSearchParams(payload).toString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetchResponse(url, {
        method: read ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(!read ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        },
        ...(!read ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 429 && attempt < 2) {
        const seconds = Number(response.headers.get('retry-after'));
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 60) {
          throw new Error(`Slack ${method} rate limited; retry the notification workflow later`);
        }
        await setTimeout(seconds * 1000);
        continue;
      }
      if (!response.ok) throw new Error(`Slack ${method}: HTTP ${response.status}`);
      const result = await response.json();
      if (!result.ok && !(method === 'reactions.add' && result.error === 'already_reacted')) {
        const details = result.response_metadata?.messages?.join('; ');
        throw new Error(`Slack ${method}: ${result.error}${details ? ` (${details})` : ''}`);
      }
      return result;
    }
  };
}

async function slackDisplayName(login, slack, core) {
  if (!login) return login;
  try {
    const slackUsers = JSON.parse(process.env.SLACK_USERS_JSON || '{}');
    const key = login.toLowerCase();
    const slackId = Object.hasOwn(slackUsers, key) ? slackUsers[key] : undefined;
    if (!slackId) return login;
    const { user } = await slack('users.info', { user: slackId });
    return user?.profile?.display_name?.trim() || login;
  } catch (error) {
    core.warning(`Could not look up Slack display name for ${login}: ${error.message}`);
    return login;
  }
}

export async function notifyDeployment({ github, context, core, slack = slackClient(process.env.SLACK_BOT_TOKEN), watch = false }) {
  const channel = process.env.DEPLOY_SLACK_CHANNEL_ID;
  if (!channel) throw new Error('Set DEPLOY_SLACK_CHANNEL_ID and invite the Slack bot to that channel');
  const run = context.payload.workflow_run;
  let parentPayload = buildParentMessage({ run, channel });
  const parentBlockId = parentPayload.blocks[0].block_id;
  const completedBlockId = `${parentBlockId}-completed`;
  const { user_id: botUser } = await slack('auth.test');
  let cursor;
  let parent;
  do {
    const history = await slack('conversations.history', {
      channel,
      oldest: String(Date.parse(run.run_started_at ?? run.created_at) / 1000 - 60),
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    parent = history.messages.find(message =>
      message.user === botUser && message.blocks?.some(block =>
        [parentBlockId, completedBlockId].includes(block.block_id) || block.block_id?.startsWith(`${parentBlockId}-progress-`)),
    );
    cursor = history.response_metadata?.next_cursor;
  } while (!parent && cursor);

  let pullRequests;
  if (!parent) {
    pullRequests = await getPullRequests({ github, context, core });
    const merged = pullRequests.find(pr =>
      pr.merged_at && pr.base.ref === run.head_branch && pr.merge_commit_sha === run.head_sha,
    );
    let merger;
    if (merged) {
      try {
        merger = await resolveMerger({ github, repo: context.repo, run, pullRequest: merged });
      } catch (error) {
        core.warning(`Could not identify merger: ${error.message}`);
      }
    }
    const author = merged?.user?.login;
    const authorDisplayName = await slackDisplayName(author, slack, core);
    const mergerDisplayName = merger?.toLowerCase() === author?.toLowerCase()
      ? authorDisplayName
      : await slackDisplayName(merger, slack, core);
    parentPayload = buildParentMessage({ run, channel, author, merger, authorDisplayName, mergerDisplayName });
    const posted = await slack('chat.postMessage', parentPayload);
    parent = { ts: posted.ts };
  } else {
    parentPayload = {
      ...parentPayload, text: parent.text,
      blocks: [{ ...parent.blocks[0], block_id: parentBlockId }, ...parent.blocks.slice(1)],
    };
  }
  if (context.payload.action !== 'completed') {
    if (watch) await watchDeployment({ github, context, core, slack, botUser, parent, parentPayload });
    return;
  }

  const failed = ['failure', 'timed_out', 'action_required', 'startup_failure'].includes(run.conclusion);
  const reaction = failed ? 'x' : ({ success: 'white_check_mark', cancelled: 'no_entry_sign' }[run.conclusion] ?? 'grey_question');
  if (parent.blocks?.some(block => block.block_id === completedBlockId)) {
    await slack('reactions.add', { channel, timestamp: parent.ts, name: reaction });
    return;
  }

  const { message, pullRequests: completedPullRequests, jobs } = await prepareNotification({ github, context, core, pullRequests });
  await postEnvironmentUpdates({ run, jobs, slack, botUser, parent, parentPayload });
  let attributionError;
  if (failed) {
    const slackUsers = JSON.parse(process.env.SLACK_USERS_JSON || '{}');
    let deployer;
    try {
      deployer = await resolveDeployer({ github, repo: context.repo, run, pullRequests: completedPullRequests });
    } catch (error) {
      core.warning(`Could not identify deployer: ${error.message}`);
    }
    const login = deployer?.toLowerCase();
    const slackId = login && Object.hasOwn(slackUsers, login) ? slackUsers[login] : undefined;
    if (slackId) {
      message.text = `<@${slackId}> deployment failed.\n\n${message.text}`;
    } else {
      attributionError = deployer
        ? `No Slack ID for GitHub user ${deployer}; add it to the SLACK_USERS_JSON repository variable`
        : 'Could not verify the human deployer from GitHub merge history';
      message.text = `:warning: Failure ping unavailable: ${attributionError}.\n\n${message.text}`;
    }
  }
  await postReplyOnce({
    slack, botUser, parent, message,
    replyId: attributionError ? `${completedBlockId}-unattributed` : completedBlockId,
  });
  if (!attributionError) {
    await slack('chat.update', {
      channel, ts: parent.ts, text: parentPayload.text,
      blocks: [{ ...parentPayload.blocks[0], block_id: completedBlockId }, ...parentPayload.blocks.slice(1)],
    });
  }
  await slack('reactions.add', { channel, timestamp: parent.ts, name: reaction });
  if (attributionError) core.setFailed(attributionError);
}
