import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDeployer } from './deployer.mjs';

const run = {
  event: 'push', run_attempt: 1, head_sha: 'abc123', head_branch: 'main',
  actor: { login: 'github-merge-queue[bot]', type: 'Bot' },
};
const input = {
  repo: { owner: 'polarsource', repo: 'polar' }, run,
  pullRequests: [{ number: 42, merged_at: '2026-10-16T12:00:00Z', base: { ref: 'main' }, merge_commit_sha: 'abc123' }],
};

test('mentions the merger rather than the PR author or commit author', async () => {
  const deployer = await resolveDeployer({
    ...input,
    github: { graphql: async () => ({ repository: { pullRequest: {
      mergedBy: { login: 'pieterbeulque', __typename: 'User' },
    } } }) },
  });
  assert.equal(deployer, 'pieterbeulque');
});

test('uses the recorded emergency requester only for an emergency-bot merge', async () => {
  const args = {
    ...input,
    run: { ...run, head_commit: { message: 'Fix\n\nEmergency-Merge: /emergency by Yopi\n' } },
    github: { graphql: async () => ({ repository: { pullRequest: {
      mergedBy: { login: 'polar-merge-bot', __typename: 'Bot' },
    } } }) },
  };
  assert.equal(await resolveDeployer(args), 'Yopi');
  assert.equal(await resolveDeployer({ ...args, run }), null);
  args.github.graphql = async () => ({ repository: { pullRequest: {
    mergedBy: { login: 'someone-else', __typename: 'User' },
  } } });
  assert.equal(await resolveDeployer(args), 'someone-else');
});

test('uses a verified queue enqueuer and declines attribution for unknown bots', async () => {
  const pr = {
    mergedAt: '2026-10-16T12:00:00Z',
    mergedBy: { login: 'github-merge-queue', __typename: 'Bot' },
    timelineItems: { nodes: [{ createdAt: '2026-10-16T11:59:00Z', enqueuer: { login: 'Yopi' } }] },
  };
  const args = { ...input, github: { graphql: async () => ({ repository: { pullRequest: pr } }) } };
  assert.equal(await resolveDeployer(args), 'Yopi');
  pr.mergedBy.login = 'another-bot[bot]';
  assert.equal(await resolveDeployer(args), null);
});

test('manual deploys and reruns belong to the human who triggered that attempt', async () => {
  const triggering_actor = { login: 'frankie567', type: 'User' };
  assert.equal(await resolveDeployer({ ...input, run: { ...run, triggering_actor, event: 'workflow_dispatch' } }), 'frankie567');
  assert.equal(await resolveDeployer({ ...input, run: { ...run, triggering_actor, run_attempt: 2 } }), 'frankie567');
  assert.equal(await resolveDeployer({ ...input, run: { ...run, run_attempt: 2 } }), null);
});

test('does not attribute unrelated PRs to a direct push', async () => {
  assert.equal(await resolveDeployer({ ...input, run: { ...run, head_sha: 'other' } }), null);
  assert.equal(await resolveDeployer({ ...input, run: { ...run, head_sha: 'other', actor: { login: 'Yopi', type: 'User' } } }), 'Yopi');
});
