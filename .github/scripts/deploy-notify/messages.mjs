const environments = {
  production: 'srv-ci4r87h8g3ne0dmvvl60',
  sandbox: 'srv-crkocgbtq21c73ddsdbg',
  test: 'srv-d8ffbc42m8qs73e7lv30',
};

function escapeText(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function link(url, label) {
  return `<${escapeText(url)}|${escapeText(label)}>`;
}

function jobStatus(job) {
  if (!job) return 'not run in this attempt';
  const conclusion = job.conclusion ?? 'unknown';
  const icon = {
    success: ':white_check_mark:',
    failure: ':x:',
    timed_out: ':alarm_clock:',
    cancelled: ':no_entry_sign:',
    skipped: ':fast_forward:',
  }[conclusion] ?? ':grey_question:';
  return `${icon} ${link(job.html_url, conclusion)}`;
}

export function buildParentMessage({ run, channel }) {
  const title = escapeText((run.head_commit?.message ?? '').split('\n')[0].slice(0, 200));
  const pullRequest = title.match(/\(#(\d+)\)$/)?.[1];
  const attempt = run.run_attempt > 1 ? ` (attempt ${run.run_attempt})` : '';
  const meta = [
    link(run.html_url, `Workflow run${attempt}`),
    link(`${run.repository.html_url}/commit/${run.head_sha}`, run.head_sha.slice(0, 7)),
    pullRequest && link(`${run.repository.html_url}/pull/${pullRequest}`, `PR #${pullRequest}`),
  ].filter(Boolean).join('  ·  ');
  return {
    channel, unfurl_links: false, unfurl_media: false,
    text: `Deploying: ${title}`,
    blocks: [
      {
        type: 'section',
        block_id: `deployment-${run.id}-${run.run_attempt}`,
        text: { type: 'mrkdwn', text: `Deploying: ${title}` },
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: meta }] },
    ],
  };
}

function environmentJobs(jobs, environment) {
  const name = environment[0].toUpperCase() + environment.slice(1);
  const deployment = jobs.filter(job => job.name.startsWith(`Deploy to ${name} `));
  return {
    backend: deployment.find(job => job.name.includes('/ Backend: Deploy to ')),
    build: deployment.find(job => job.name.endsWith('/ Frontend: Build')),
    promotion: deployment.find(job => job.name.endsWith('/ Frontend: Promote to Production')),
    lambda: jobs.find(job => job.name.startsWith(`Deploy Lambda Worker to ${name} `)),
  };
}

function environmentLines(run, environment, jobs) {
  const { backend, build, promotion, lambda } = environmentJobs(jobs, environment);
  const logfire = new URL('https://logfire-us.pydantic.dev/polar/polar/');
  logfire.searchParams.set('q', `deployment_environment = '${environment}'`);
  logfire.searchParams.set('since', run.run_started_at);
  const sentry = new URL('https://polar-sh.sentry.io/issues/');
  sentry.searchParams.set('environment', environment);
  return [
    `*${environment}*`,
    `Render: ${jobStatus(backend)} · Frontend build: ${jobStatus(build)} · Frontend promotion: ${jobStatus(promotion)}`,
    `Lambda update request: ${jobStatus(lambda)}`,
    [
      link(logfire.href, 'Logfire'),
      link(sentry.href, 'Sentry'),
      link(`https://dashboard.render.com/web/${environments[environment]}`, 'Render API'),
    ].join(' · '),
  ];
}

export function buildEnvironmentUpdates({ run, jobs, channel }) {
  return Object.keys(environments).flatMap(environment => {
    const components = Object.values(environmentJobs(jobs, environment));
    const present = components.filter(Boolean);
    if (!present.length || present.some(job => job.status !== 'completed')) return [];
    if (run.status !== 'completed' && present.length !== components.length) return [];
    const conclusions = present.map(job => job.conclusion);
    return [{
      environment,
      succeeded: conclusions.includes('success') && conclusions.every(conclusion => ['success', 'skipped'].includes(conclusion)),
      message: {
        channel, unfurl_links: false, unfurl_media: false,
        text: [
          ...environmentLines(run, environment, jobs),
          'Deployment jobs finished. Skipped / not run does not mean deployed. Lambda reports the update request, not rollout health.',
        ].join('\n'),
      },
    }];
  });
}

export function buildMessage({ run, jobs, pullRequests, channel }) {
  const title = escapeText((run.head_commit?.message ?? '').split('\n')[0].slice(0, 200));
  const lines = [
    `*Deployment run: ${escapeText(run.conclusion ?? 'unknown')}*`,
    `${link(run.html_url, `Run #${run.run_number}, attempt ${run.run_attempt}`)} · ${link(`${run.repository.html_url}/commit/${run.head_sha}`, run.head_sha.slice(0, 7))} · ${escapeText(run.head_branch)} · ${escapeText((run.triggering_actor ?? run.actor).login)}`,
    title,
  ];

  if (pullRequests.length) {
    lines.push(`Head commit PR: ${pullRequests.slice(0, 5).map(pr => link(pr.html_url, `#${pr.number}`)).join(', ')}`);
  }

  for (const environment of Object.keys(environments)) {
    lines.push('', ...environmentLines(run, environment, jobs));
  }

  const failedJobs = jobs.filter(job => ['failure', 'timed_out', 'action_required', 'startup_failure'].includes(job.conclusion));
  if (failedJobs.length) {
    lines.push('', '*Failed jobs*');
    for (const job of failedJobs.slice(0, 10)) {
      lines.push(`${link(job.html_url, job.name)}: ${escapeText(job.conclusion)}`);
    }
    if (failedJobs.length > 10) lines.push(`See workflow for ${failedJobs.length - 10} more failed jobs.`);
  }

  lines.push('', 'Skipped / not run does not mean deployed. Lambda reports the update request, not rollout health.');
  return { channel, text: lines.join('\n'), unfurl_links: false, unfurl_media: false };
}

export async function prepareNotification({ github, context, core }) {
  const run = context.payload.workflow_run;
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
    ...context.repo,
    run_id: run.id,
    attempt_number: run.run_attempt,
    per_page: 100,
  });
  let pullRequests = [];
  try {
    pullRequests = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
      ...context.repo,
      commit_sha: run.head_sha,
      per_page: 100,
    });
  } catch (error) {
    core.warning(`Could not look up head commit PRs: ${error.message}`);
  }
  const message = buildMessage({ run, jobs, pullRequests, channel: process.env.DEPLOY_SLACK_CHANNEL_ID });
  await core.summary.addRaw(message.text.replace(/<(https:\/\/[^|]+)\|([^>]+)>/g, '[$2]($1)')).write();
  return { message, pullRequests, jobs };
}
