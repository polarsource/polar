export async function resolveDeployer({ github, repo, run, pullRequests }) {
  const trigger = run.triggering_actor ?? run.actor;
  if (run.event === 'workflow_dispatch' || run.run_attempt > 1) {
    return trigger?.type === 'User' ? trigger.login : null;
  }

  const merged = pullRequests.find(pr =>
    pr.merged_at && pr.base.ref === run.head_branch && pr.merge_commit_sha === run.head_sha,
  );
  if (!merged) return trigger?.type === 'User' ? trigger.login : null;

  return resolveMerger({ github, repo, run, pullRequest: merged });
}

export async function resolveMerger({ github, repo, run, pullRequest }) {
  const { repository } = await github.graphql(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          mergedAt
          mergedBy { login __typename }
          timelineItems(last: 1, itemTypes: [ADDED_TO_MERGE_QUEUE_EVENT]) {
            nodes { ... on AddedToMergeQueueEvent { createdAt enqueuer { login } } }
          }
        }
      }
    }
  `, { ...repo, number: pullRequest.number });
  const pr = repository.pullRequest;
  if (pr.mergedBy?.__typename === 'User') return pr.mergedBy.login;
  const mergeBot = pr.mergedBy?.login.replace(/\[bot\]$/, '');

  if (mergeBot === 'polar-merge-bot') {
    return run.head_commit?.message.match(/(?:^|\n)Emergency-Merge: \/emergency by ([a-zA-Z0-9-]+)\s*$/)?.[1] ?? null;
  }

  if (mergeBot !== 'github-merge-queue') return null;
  const queued = pr.timelineItems.nodes[0];
  if (queued?.createdAt <= pr.mergedAt) return queued.enqueuer?.login ?? null;
  return null;
}
