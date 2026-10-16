import { setTimeout } from 'node:timers/promises';
import { buildEnvironmentUpdates } from './messages.mjs';
import { postReplyOnce } from './replies.mjs';

const reactions = { test: 'baby_chick', sandbox: 'child', production: 'older_woman' };

export async function postEnvironmentUpdates({ run, jobs, slack, botUser, parent, parentPayload }) {
  const prefix = `${parentPayload.blocks[0].block_id}-progress-`;
  const marker = parent.blocks?.find(block => block.block_id?.startsWith(prefix))?.block_id;
  const reported = new Set(marker ? marker.slice(prefix.length).split(',') : []);
  for (const { environment, succeeded, message } of buildEnvironmentUpdates({ run, jobs, channel: parentPayload.channel })) {
    if (reported.has(environment)) continue;
    await postReplyOnce({ slack, botUser, parent, message, replyId: `${prefix}${environment}` });
    if (succeeded) {
      await slack('reactions.add', { channel: parentPayload.channel, timestamp: parent.ts, name: reactions[environment] });
    }
    reported.add(environment);
    const blocks = [{ ...parentPayload.blocks[0], block_id: `${prefix}${[...reported].join(',')}` }, ...parentPayload.blocks.slice(1)];
    await slack('chat.update', {
      channel: parentPayload.channel, ts: parent.ts, text: parentPayload.text, blocks,
    });
    parent.blocks = blocks;
  }
}

export async function watchDeployment({
  github, context, core, slack, botUser, parent, parentPayload, sleep = setTimeout, now = Date.now,
}) {
  const run = context.payload.workflow_run;
  if (parent.blocks?.some(block => block.block_id === `${parentPayload.blocks[0].block_id}-completed`)) return;
  const deadline = now() + 350 * 60_000;
  while (now() < deadline) {
    const { data: attempt } = await github.rest.actions.getWorkflowRunAttempt({
      ...context.repo, run_id: run.id, attempt_number: run.run_attempt,
    });
    const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
      ...context.repo, run_id: run.id, attempt_number: run.run_attempt, per_page: 100,
    });
    await postEnvironmentUpdates({ run: { ...run, ...attempt }, jobs, slack, botUser, parent, parentPayload });
    if (attempt.status === 'completed') return;
    await sleep(30_000);
  }
  core.warning('Stopped watching after 350 minutes; the completion event will still post the final deployment summary.');
}
