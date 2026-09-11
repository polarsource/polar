import { commands } from '@polar-sh/cli-commands'
import { Effect, Layer } from 'effect'
import { Command, Prompt } from 'effect/unstable/cli'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as ApiRuntime from '@/services/api-runtime'
import { Auth } from '@/services/auth'
import * as Polar from '@/services/polar'
import { runCli, type RunCliOptions } from '@/utils/test-utils/cli'
import { fakeAuth } from '@/utils/test-utils/services'

vi.mock('effect/unstable/cli', async (importOriginal) => {
  const cli = await importOriginal<typeof import('effect/unstable/cli')>()
  return { ...cli, Prompt: { ...cli.Prompt, run: vi.fn() } }
})

const root = Command.make('polar').pipe(Command.withSubcommands(commands))
let requests: Request[]
let auth: ReturnType<typeof fakeAuth>

beforeEach(() => {
  requests = []
  auth = fakeAuth()
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init))
    return Promise.resolve(Response.json({ id: 'resource-1' }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

const run = (args: string[], options: RunCliOptions = {}) => {
  const cli = runCli(root, args, options)
  const runtime = ApiRuntime.layer.pipe(
    Layer.provide(Polar.layer),
    Layer.provide(Layer.succeed(Auth, auth.auth)),
  )
  return {
    ...cli,
    promise: Effect.runPromise(cli.effect.pipe(Effect.provide(runtime))),
  }
}

describe('CLI-tagged API commands', () => {
  test.each([
    { args: ['products', 'list'], method: 'GET', path: '/v1/products/' },
    {
      args: ['organizations', 'get', 'org-1'],
      method: 'GET',
      path: '/v1/organizations/org-1',
    },
    {
      args: ['subscriptions', 'revoke', 'sub-1', '--confirm'],
      method: 'DELETE',
      path: '/v1/subscriptions/sub-1',
    },
    {
      args: ['webhooks', 'list_webhook_endpoints'],
      method: 'GET',
      path: '/v1/webhooks/endpoints',
    },
    {
      args: ['license_keys', 'get_activation', 'key-1', 'activation-1'],
      method: 'GET',
      path: '/v1/license-keys/key-1/activations/activation-1',
    },
    {
      args: ['customers', 'members', 'get', 'customer-1', 'member-1'],
      method: 'GET',
      path: '/v1/customers/customer-1/members/member-1',
    },
  ])(
    '$args invokes the matching SDK method',
    async ({ args, method, path }) => {
      await run(args).promise
      expect(requests).toHaveLength(1)
      expect(requests[0]!.method).toBe(method)
      expect(new URL(requests[0]!.url).pathname).toBe(path)
    },
  )

  test('nested member creation keeps path and body external IDs separate', async () => {
    await run([
      'customers',
      'members',
      'create_external',
      'customer/123',
      '--external-id=member-456',
      '--email=member@example.com',
    ]).promise
    expect(new URL(requests[0]!.url).pathname).toBe(
      '/v1/customers/external/customer%2F123/members',
    )
    expect(await requests[0]!.json()).toEqual({
      external_id: 'member-456',
      email: 'member@example.com',
    })
  })

  test.each(['create', 'update'])(
    'benefits %s accepts union discriminator flags',
    async (operation) => {
      await run([
        'benefits',
        operation,
        ...(operation === 'update' ? ['benefit-1'] : []),
        '--type=custom',
        '--description=A custom benefit',
        '--properties={}',
      ]).promise
      expect(await requests[0]!.json()).toEqual({
        type: 'custom',
        description: 'A custom benefit',
        properties: {},
      })
    },
  )

  test.each([200, 403, 500])(
    'DELETE previews the record, with fallback for GET status %i',
    async (status) => {
      vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init)
        requests.push(request)
        return Promise.resolve(
          request.method === 'GET'
            ? Response.json({ id: 'customer-1', name: 'Alice' }, { status })
            : new Response(null, { status: 204 }),
        )
      })
      vi.mocked(Prompt.run).mockImplementation(() => {
        expect(requests.map((request) => request.method)).toEqual(['GET'])
        return Effect.succeed('yes')
      })
      const cli = run(['customers', 'delete', 'customer-1', '--anonymize'], {
        interactive: true,
      })
      await cli.promise
      expect(requests.map((request) => request.method)).toEqual([
        'GET',
        'DELETE',
      ])
      expect(new URL(requests[0]!.url).search).toBe('')
      expect(new URL(requests[1]!.url).searchParams.get('anonymize')).toBe(
        'true',
      )
      expect(cli.terminal()).toContain('External ID')
      expect(cli.terminal()).toContain('…\n\n')
      expect(cli.output().includes('Alice')).toBe(status === 200)
      expect(cli.output()).toContain('Confirm destructive request')
    },
  )

  test('a preview 404 exits without prompting or deleting', async () => {
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init))
      return Promise.resolve(
        Response.json({ detail: 'Not found' }, { status: 404 }),
      )
    })
    vi.mocked(Prompt.run).mockReturnValue(Effect.succeed('yes'))
    await expect(
      run(['customers', 'delete', 'missing-id'], { interactive: true }).promise,
    ).rejects.toThrow('Resource does not exist.')
    expect(Prompt.run).not.toHaveBeenCalled()
    expect(requests.map((request) => request.method)).toEqual(['GET'])
  })

  test('cancelling after a preview never sends DELETE', async () => {
    vi.mocked(Prompt.run).mockReturnValue(Effect.succeed('no'))
    await expect(
      run(['customers', 'delete', 'customer-1'], { interactive: true }).promise,
    ).rejects.toThrow('Command cancelled.')
    expect(requests.map((request) => request.method)).toEqual(['GET'])
  })

  test.each([
    ['organizations', 'update', 'org-1'],
    ['checkouts', 'create'],
    ['customers', 'export'],
  ])('untagged command %j is unavailable', async (...args) => {
    await expect(run(args).promise).rejects.toThrow()
    expect(requests).toHaveLength(0)
    expect(auth.state.resolutions).toHaveLength(0)
  })

  test('every generated resource and operation renders help without authentication', async () => {
    const queue: { command: Command.Command.Any; args: string[] }[] = [
      { command: root, args: [] },
    ]
    for (const { command, args } of queue) {
      const cli = run([...args, '--help'])
      await cli.promise
      expect(cli.output()).toContain('USAGE')
      expect(cli.output()).not.toContain('--production')
      for (const group of command.subcommands) {
        for (const child of group.commands) {
          queue.push({ command: child, args: [...args, child.name] })
        }
      }
    }
    expect(queue.length).toBeGreaterThan(commands.length)
    expect(requests).toHaveLength(0)
    expect(auth.state.resolutions).toHaveLength(0)
  })
})
