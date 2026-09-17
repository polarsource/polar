import { beforeEach, describe, expect, vi, test } from 'vitest'
import release from './release.js'

const context = {
  eventName: 'push',
  ref: 'refs/heads/main',
  sha: 'release-commit',
  runId: 123,
  repo: { owner: 'polarsource', repo: 'polar' },
  payload: { before: 'previous-commit' },
}
const outputs = new Map<string, unknown>()
const core = {
  setOutput: (name: string, value: unknown) => outputs.set(name, value),
  info: vi.fn(),
}
const getContent = vi.fn(async () => ({
  data: { content: Buffer.from('{"version":"1.3.9"}').toString('base64') },
}))
const getReleaseByTag = vi.fn(
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
    await release({ github, context, core, version: '1.4.0' })

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

    await release({ github, context, core, version: '1.4.0' })

    expect(outputs.get('enabled')).toBe(false)
    expect(getReleaseByTag).not.toHaveBeenCalled()
  })

  test('does not release the unchanged version when the CLI is first imported', async () => {
    getContent.mockRejectedValueOnce(
      Object.assign(new Error('Not found'), { status: 404 }),
    )

    await release({ github, context, core, version: '1.4.0' })

    expect(outputs.get('enabled')).toBe(false)
  })

  test('skips a version that has already been published', async () => {
    getReleaseByTag.mockResolvedValueOnce({
      data: { draft: false, target_commitish: context.sha },
    })

    await release({ github, context, core, version: '1.4.0' })

    expect(outputs.get('enabled')).toBe(false)
  })

  test('resumes a draft only from its original source commit', async () => {
    getReleaseByTag.mockResolvedValueOnce({
      data: { draft: true, target_commitish: context.sha },
    })
    await release({ github, context, core, version: '1.4.0' })
    expect(outputs.get('enabled')).toBe(true)

    getReleaseByTag.mockResolvedValueOnce({
      data: { draft: true, target_commitish: 'another-commit' },
    })
    await expect(
      release({ github, context, core, version: '1.4.0' }),
    ).rejects.toThrow('Retry the original workflow run')
  })

  test('does not treat API failures as an unpublished version', async () => {
    getReleaseByTag.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    )

    await expect(
      release({ github, context, core, version: '1.4.0' }),
    ).rejects.toThrow('Forbidden')
    expect(outputs.get('enabled')).toBe(false)
  })

  test('manual runs default to a verification draft, not a stable release', async () => {
    await release({
      github,
      context: { ...context, eventName: 'workflow_dispatch', payload: {} },
      core,
      version: '1.4.0',
    })

    expect(outputs.get('enabled')).toBe(true)
    expect(outputs.get('publish')).toBe(false)
    expect(outputs.get('tag')).toBe(
      `polar-cli-verify-123-${process.env['GITHUB_RUN_ATTEMPT']}`,
    )
    expect(getContent).not.toHaveBeenCalled()
  })

  test('manual publishing can retry main without a new version bump', async () => {
    await release({
      github,
      context: {
        ...context,
        eventName: 'workflow_dispatch',
        payload: { inputs: { publish: 'true' } },
      },
      core,
      version: '1.4.0',
    })

    expect(outputs.get('enabled')).toBe(true)
    expect(outputs.get('publish')).toBe(true)
    expect(outputs.get('tag')).toBe('polar-cli@1.4.0')
    expect(getContent).not.toHaveBeenCalled()
  })

  test('rejects publishing from another branch', async () => {
    await expect(
      release({
        github,
        context: {
          ...context,
          eventName: 'workflow_dispatch',
          ref: 'refs/heads/feature',
          payload: { inputs: { publish: 'true' } },
        },
        core,
        version: '1.4.0',
      }),
    ).rejects.toThrow('only be published from main')
  })
})
