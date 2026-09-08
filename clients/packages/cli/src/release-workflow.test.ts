import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const workflow = Bun.YAML.parse(
  readFileSync(
    new URL('../../../../.github/workflows/release_cli.yml', import.meta.url),
    'utf8',
  ),
) as {
  jobs: {
    prepare: {
      steps: { id?: string; with?: { script: string } }[]
    }
  }
}
const script = workflow.jobs.prepare.steps.find((step) => step.id === 'release')
  ?.with?.script
if (!script) throw new Error('Release planning step is missing')

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>
const runPrepare = new AsyncFunction(
  'require',
  'github',
  'context',
  'core',
  script,
)

const context = {
  eventName: 'push',
  ref: 'refs/heads/main',
  sha: 'release-commit',
  runId: 123,
  repo: { owner: 'polarsource', repo: 'polar' },
  payload: { before: 'previous-commit' },
}
const requireManifest = () => ({ version: '1.4.0' })
const outputs = new Map<string, unknown>()
const core = {
  setOutput: (name: string, value: unknown) => outputs.set(name, value),
  info: mock(),
}
const getContent = mock(async () => ({
  data: { content: Buffer.from('{"version":"1.3.9"}').toString('base64') },
}))
const getReleaseByTag = mock(
  async (): Promise<{
    data: { draft: boolean; target_commitish: string }
  }> => {
    throw Object.assign(new Error('Not found'), { status: 404 })
  },
)
const github = { rest: { repos: { getContent, getReleaseByTag } } }

beforeEach(() => {
  outputs.clear()
  getContent.mockClear()
  getReleaseByTag.mockClear()
})

describe('CLI release planning', () => {
  test('releases a bumped version from main under a CLI-specific tag', async () => {
    await runPrepare(requireManifest, github, context, core)

    expect(outputs.get('enabled')).toBe(true)
    expect(outputs.get('publish')).toBe(true)
    expect(outputs.get('tag')).toBe('polar-cli@1.4.0')
    expect(getContent).toHaveBeenCalledWith({
      ...context.repo,
      path: 'clients/packages/cli/package.json',
      ref: 'previous-commit',
    })
  })

  test('does not release when only package metadata changes', async () => {
    getContent.mockResolvedValueOnce({
      data: { content: Buffer.from('{"version":"1.4.0"}').toString('base64') },
    })

    await runPrepare(requireManifest, github, context, core)

    expect(outputs.get('enabled')).toBe(false)
    expect(getReleaseByTag).not.toHaveBeenCalled()
  })

  test('does not release the unchanged version when the CLI is first imported', async () => {
    getContent.mockRejectedValueOnce(
      Object.assign(new Error('Not found'), { status: 404 }),
    )

    await runPrepare(requireManifest, github, context, core)

    expect(outputs.get('enabled')).toBe(false)
  })

  test('skips a version that has already been published', async () => {
    getReleaseByTag.mockResolvedValueOnce({
      data: { draft: false, target_commitish: context.sha },
    })

    await runPrepare(requireManifest, github, context, core)

    expect(outputs.get('enabled')).toBe(false)
  })

  test('resumes a draft only from its original source commit', async () => {
    getReleaseByTag.mockResolvedValueOnce({
      data: { draft: true, target_commitish: context.sha },
    })
    await runPrepare(requireManifest, github, context, core)
    expect(outputs.get('enabled')).toBe(true)

    getReleaseByTag.mockResolvedValueOnce({
      data: { draft: true, target_commitish: 'another-commit' },
    })
    await expect(
      runPrepare(requireManifest, github, context, core),
    ).rejects.toThrow('Retry the original workflow run')
  })

  test('does not treat API failures as an unpublished version', async () => {
    getReleaseByTag.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    )

    await expect(
      runPrepare(requireManifest, github, context, core),
    ).rejects.toThrow('Forbidden')
    expect(outputs.get('enabled')).toBe(false)
  })

  test('manual runs default to a verification draft, not a stable release', async () => {
    await runPrepare(
      requireManifest,
      github,
      { ...context, eventName: 'workflow_dispatch', payload: {} },
      core,
    )

    expect(outputs.get('enabled')).toBe(true)
    expect(outputs.get('publish')).toBe(false)
    expect(outputs.get('tag')).toBe(
      `polar-cli-verify-123-${process.env['GITHUB_RUN_ATTEMPT']}`,
    )
    expect(getContent).not.toHaveBeenCalled()
  })

  test('manual publishing can retry main without a new version bump', async () => {
    await runPrepare(
      requireManifest,
      github,
      {
        ...context,
        eventName: 'workflow_dispatch',
        payload: { inputs: { publish: 'true' } },
      },
      core,
    )

    expect(outputs.get('enabled')).toBe(true)
    expect(outputs.get('publish')).toBe(true)
    expect(outputs.get('tag')).toBe('polar-cli@1.4.0')
    expect(getContent).not.toHaveBeenCalled()
  })

  test('rejects publishing from another branch', async () => {
    await expect(
      runPrepare(
        requireManifest,
        github,
        {
          ...context,
          eventName: 'workflow_dispatch',
          ref: 'refs/heads/feature',
          payload: { inputs: { publish: 'true' } },
        },
        core,
      ),
    ).rejects.toThrow('only be published from main')
  })
})
