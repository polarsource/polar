import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, it, vi } from 'vitest'
import { defineConfig } from '../src/config/config'
import { run } from '../src/cli/index'

let directory: string
let file: string
const requests: Request[] = []
const config = defineConfig({ schema: {} })
const load = async () => ({ config })
const first = {
  default_variant_id: null,
  id: 'org-1',
  name: 'First',
  slug: 'first',
  created_at: '2026-09-06T00:00:00Z',
}
const second = { ...first, id: 'org-2', name: 'Second', slug: 'second' }

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'void-login-'))
  file = join(directory, 'void', 'credentials.json')
  vi.stubEnv('VOID_CREDENTIALS_FILE', file)
  vi.stubEnv('VOID_TOKEN', undefined)
  vi.stubEnv('VOID_API_URL', undefined)
  requests.length = 0
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    const token = request.headers.get('authorization')
    if (token !== 'Bearer first-secret' && token !== 'Bearer second-secret') {
      return Response.json(
        { error: 'Unauthorized', detail: 'Invalid token' },
        { status: 401 },
      )
    }
    if (new URL(request.url).pathname === '/v1/void/organizations/current') {
      return Response.json(token === 'Bearer first-secret' ? first : second)
    }
    return Response.json(
      {
        variant_id: null,
        checksum: 'test',
        applied: true,
        id: 'd1',
        entries: [],
        created_at: first.created_at,
      },
      { status: 201 },
    )
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

const login = () =>
  run(['login', '--api-url', 'http://void/', '--token', 'first-secret'], load)

it('login validates and saves private credentials; plan and deploy revalidate and display the target', async () => {
  await login()
  const saved = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(saved.profiles[0].apiUrl, 'http://void')
  assert.equal(saved.profiles[0].token, 'first-secret')
  assert.equal(saved.profiles[0].organization.id, first.id)
  assert.equal((await stat(file)).mode & 0o777, 0o600)
  assert.equal((await stat(join(directory, 'void'))).mode & 0o777, 0o700)
  for (const command of ['plan', 'deploy']) {
    await run([command, '--config', 'void.ts'], load)
  }
  assert.deepEqual(
    requests.map((r) => new URL(r.url).pathname),
    [
      '/v1/void/organizations/current',
      '/v1/void/organizations/current',
      '/v1/void/deploys',
      '/v1/void/organizations/current',
      '/v1/void/deploys',
    ],
  )
  assert.ok(
    requests.every(
      (r) => r.headers.get('authorization') === 'Bearer first-secret',
    ),
  )
  assert.ok(
    requests.every(
      (request) => request.headers.get('Polar-Version') === '2026-04',
    ),
  )
  assert.equal(requests[0]!.headers.get('x-void-config'), null)
  assert.equal((await requests[2]!.json()).dry_run, true)
  assert.equal((await requests[4]!.json()).dry_run, false)
  const output = vi.mocked(console.log).mock.calls.flat().join('\n')
  assert.ok(output.includes('First (first)  http://void'))
  assert.ok(!output.includes('first-secret'))
})

it('environment credentials override saved login and flags override environment credentials', async () => {
  await login()
  vi.stubEnv('VOID_TOKEN', 'second-secret')
  vi.stubEnv('VOID_API_URL', 'http://second')
  await run(['plan', '--config', 'void.ts'], load)
  assert.equal(
    requests.at(-1)?.headers.get('authorization'),
    'Bearer second-secret',
  )
  assert.equal(new URL(requests.at(-1)!.url).origin, 'http://second')
  await run(
    [
      'deploy',
      '--config',
      'void.ts',
      '--api-url',
      'http://void',
      '--token',
      'first-secret',
    ],
    load,
  )
  assert.equal(
    requests.at(-1)?.headers.get('authorization'),
    'Bearer first-secret',
  )
  assert.equal(new URL(requests.at(-1)!.url).origin, 'http://void')
})

it('a saved token is never sent to a different server', async () => {
  await login()
  requests.length = 0
  await assert.rejects(
    run(['plan', '--config', 'void.ts', '--api-url', 'http://other'], load),
    /No token for this server/,
  )
  assert.equal(requests.length, 0)
})

it('failed login preserves existing credentials and revoked credentials cannot deploy', async () => {
  await login()
  const saved = await readFile(file, 'utf8')
  await assert.rejects(
    run(['login', '--api-url', 'http://void', '--token', 'bad-secret'], load),
    /Invalid token/,
  )
  assert.equal(await readFile(file, 'utf8'), saved)
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    requests.push(new Request(input, init))
    return Response.json(
      { error: 'Unauthorized', detail: 'Revoked token' },
      { status: 401 },
    )
  })
  requests.length = 0
  await assert.rejects(
    run(['deploy', '--config', 'void.ts'], load),
    /Revoked token/,
  )
  assert.equal(requests.length, 1)
  assert.equal(
    new URL(requests[0]!.url).pathname,
    '/v1/void/organizations/current',
  )
  assert.ok(
    !vi
      .mocked(console.error)
      .mock.calls.flat()
      .join('\n')
      .includes('bad-secret'),
  )
})

it('logout removes saved credentials and explicit CI credentials need no saved file', async () => {
  await login()
  await run(['logout'], load)
  await assert.rejects(readFile(file), { code: 'ENOENT' })
  await run(['logout'], load)
  await assert.rejects(
    run(['plan', '--config', 'void.ts'], load),
    /No server URL/,
  )
  await run(
    [
      'plan',
      '--config',
      'void.ts',
      '--api-url',
      'http://void',
      '--token',
      'second-secret',
    ],
    load,
  )
  assert.equal(
    requests.at(-1)?.headers.get('authorization'),
    'Bearer second-secret',
  )
})

it('corrupt credential errors do not expose file contents and explicit credentials bypass the file', async () => {
  await login()
  await writeFile(file, 'corrupt first-secret')
  await assert.rejects(
    run(['plan', '--config', 'void.ts'], load),
    /Saved credentials are invalid/,
  )
  assert.ok(
    !vi
      .mocked(console.error)
      .mock.calls.flat()
      .join('\n')
      .includes('first-secret'),
  )
  await run(
    [
      'plan',
      '--config',
      'void.ts',
      '--api-url',
      'http://void',
      '--token',
      'second-secret',
    ],
    load,
  )
})

it('invalid URLs and empty explicit tokens fail before any request', async () => {
  for (const url of [
    'not-a-url',
    'file:///tmp/api',
    'https://user:secret@example.com',
  ]) {
    await assert.rejects(
      run(['login', '--api-url', url, '--token', 'first-secret'], load),
      /Server URL must/,
    )
  }
  await assert.rejects(
    run(
      [
        'plan',
        '--config',
        'void.ts',
        '--api-url',
        'http://void',
        '--token',
        ' ',
      ],
      load,
    ),
    /access token is required/,
  )
  assert.equal(requests.length, 0)
  await assert.rejects(readFile(file), { code: 'ENOENT' })
})

it('profiles retain separate organizations and switch validates the selected token', async () => {
  await run(
    [
      'login',
      '--profile',
      'first',
      '--api-url',
      'http://void',
      '--token',
      'first-secret',
    ],
    load,
  )
  await run(
    [
      'login',
      '--profile',
      'second',
      '--api-url',
      'http://void',
      '--token',
      'second-secret',
    ],
    load,
  )
  await run(['profiles'], load)
  const listing = vi.mocked(console.log).mock.calls.flat().join('\n')
  assert.ok(listing.includes('* second'))
  assert.ok(listing.includes('first  First'))
  assert.ok(!listing.includes('secret'))
  await run(['switch', 'first'], load)
  await run(['whoami'], load)
  assert.equal(
    requests.at(-1)?.headers.get('authorization'),
    'Bearer first-secret',
  )
  await run(['deploy', '--profile', 'second', '--config', 'void.ts'], load)
  assert.equal(
    requests.at(-1)?.headers.get('authorization'),
    'Bearer second-secret',
  )
  const saved = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(saved.activeProfile, 'first')
  assert.equal(saved.profiles.length, 2)
})

it('an explicit profile rejects environment credential overrides and unknown profiles', async () => {
  await login()
  requests.length = 0
  await assert.rejects(
    run(['whoami', '--profile', 'missing'], load),
    /No saved profile/,
  )
  vi.stubEnv('VOID_TOKEN', 'second-secret')
  await assert.rejects(
    run(['whoami', '--profile', 'first@void'], load),
    /cannot be combined/,
  )
  assert.equal(requests.length, 0)
})

it('failed switching preserves the active profile and profile names cannot change organizations', async () => {
  await login()
  const saved = await readFile(file, 'utf8')
  await assert.rejects(
    run(
      [
        'login',
        '--profile',
        'first@void',
        '--api-url',
        'http://void',
        '--token',
        'second-secret',
      ],
      load,
    ),
    /different organization or server/,
  )
  assert.equal(await readFile(file, 'utf8'), saved)
  vi.mocked(globalThis.fetch).mockResolvedValue(
    Response.json(
      { error: 'Unauthorized', detail: 'Revoked token' },
      { status: 401 },
    ),
  )
  await assert.rejects(run(['switch', 'first@void'], load), /Revoked token/)
  assert.equal(await readFile(file, 'utf8'), saved)
})

it('a profile whose token resolves to another organization cannot deploy', async () => {
  await login()
  const saved = JSON.parse(await readFile(file, 'utf8'))
  saved.profiles[0].token = 'second-secret'
  await writeFile(file, JSON.stringify(saved))
  requests.length = 0
  await assert.rejects(
    run(['deploy', '--config', 'void.ts'], load),
    /does not match the saved profile/,
  )
  assert.equal(requests.length, 1)
})

it('legacy credentials remain usable and migrate when another profile is saved', async () => {
  await login()
  await writeFile(
    file,
    JSON.stringify({
      apiUrl: 'http://void',
      token: 'first-secret',
      organization: first,
    }),
  )
  await run(['whoami'], load)
  assert.equal(
    requests.at(-1)?.headers.get('authorization'),
    'Bearer first-secret',
  )
  await run(
    [
      'login',
      '--profile',
      'second',
      '--api-url',
      'http://void',
      '--token',
      'second-secret',
    ],
    load,
  )
  const saved = JSON.parse(await readFile(file, 'utf8'))
  assert.deepEqual(
    saved.profiles.map((entry: { name: string }) => entry.name),
    ['default', 'second'],
  )
  await run(['switch', 'default'], load)
})

it('logout removes only the selected profile without silently switching organizations', async () => {
  await login()
  await run(
    [
      'login',
      '--profile',
      'second',
      '--api-url',
      'http://void',
      '--token',
      'second-secret',
    ],
    load,
  )
  await run(['logout'], load)
  const saved = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(saved.activeProfile, null)
  assert.equal(saved.profiles.length, 1)
  await assert.rejects(run(['whoami'], load), /No server URL/)
  await run(['switch', 'first@void'], load)
  await run(['logout', '--all'], load)
  await assert.rejects(readFile(file), { code: 'ENOENT' })
})
