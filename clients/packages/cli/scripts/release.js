import { Buffer } from 'node:buffer'
import process from 'node:process'
import manifest from '../package.json' with { type: 'json' }

export default async ({
  github,
  context,
  core,
  version = manifest.version,
}) => {
  const publish =
    context.eventName === 'push' || context.payload.inputs?.publish === 'true'
  core.setOutput('enabled', false)
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('CLI releases require a stable semantic version')
  }
  if (publish && context.ref !== 'refs/heads/main') {
    throw new Error('CLI releases can only be published from main')
  }
  if (context.eventName === 'push') {
    let previousVersion
    try {
      const { data } = await github.rest.repos.getContent({
        ...context.repo,
        path: 'clients/packages/cli/package.json',
        ref: context.payload.before,
      })
      previousVersion = JSON.parse(
        Buffer.from(data.content, 'base64').toString(),
      ).version
    } catch (error) {
      if (error.status !== 404) throw error
    }
    if (!previousVersion || previousVersion === version) return
  }
  const tag = publish
    ? `polar-cli@${version}`
    : `polar-cli-verify-${context.runId}-${process.env.GITHUB_RUN_ATTEMPT}`
  try {
    const { data } = await github.rest.repos.getReleaseByTag({
      ...context.repo,
      tag,
    })
    if (!data.draft) {
      core.info(`${tag} is already published`)
      return
    }
    if (data.target_commitish !== context.sha) {
      throw new Error(
        'Retry the original workflow run to finish this draft release',
      )
    }
  } catch (error) {
    if (error.status !== 404) throw error
  }
  core.setOutput('enabled', true)
  core.setOutput('tag', tag)
  core.setOutput('publish', publish)
}
