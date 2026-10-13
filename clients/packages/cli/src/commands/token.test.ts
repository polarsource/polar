import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { Effect, Redacted } from 'effect'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { token as tokenCommand } from '@/commands/token'
import type { ActiveOrganization, PolarEnvironment } from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import { type TokenRequest, TokenHandoff } from '@/services/token-handoff'
import { runCli } from '@/utils/test-utils/cli'
import { fakeOrganizations } from '@/utils/test-utils/services'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

let dir: string
let requests: TokenRequest[]

let organizations: ReturnType<typeof fakeOrganizations>

const run = (args: string[]) => {
  const cli = runCli(tokenCommand, args)
  const promise = Effect.runPromise(
    cli.effect.pipe(
      Effect.provideService(Organizations, organizations.organizations),
      Effect.provideService(
        TokenHandoff,
        TokenHandoff.of({
          receive: (request, announce) =>
            announce(new URL('https://polar.sh/dashboard/acme/cli/token')).pipe(
              Effect.as(Redacted.make('polar_oat_secret')),
              Effect.tap(() => Effect.sync(() => requests.push(request))),
            ),
        }),
      ),
    ),
  )
  return { promise, output: cli.output }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'polar-test-'))
  requests = []
  organizations = fakeOrganizations({
    items: [acme],
    selected: { id: acme.id, environment: acme.environment },
  })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('writes the token to the env file without printing it', async () => {
  const file = join(dir, '.env')
  await writeFile(file, 'OTHER=1\nPOLAR_ACCESS_TOKEN=old\n')
  const { promise, output } = run([
    '--env-file',
    file,
    '--scope',
    'products:read',
    '--scope',
    'checkouts:write',
  ])
  await promise

  expect(await readFile(file, 'utf8')).toBe(
    'OTHER=1\nPOLAR_ACCESS_TOKEN=polar_oat_secret\nPOLAR_ENVIRONMENT=sandbox\n',
  )
  expect(requests).toEqual([
    {
      organization: { slug: 'acme', environment: 'sandbox' },
      name: basename(process.cwd()),
      scopes: ['products:read', 'checkouts:write'],
    },
  ])
  expect(output()).toContain('Updated POLAR_ACCESS_TOKEN')
  expect(output()).not.toContain('polar_oat_secret')
})

const selectEnvironment = (environment: PolarEnvironment) => {
  organizations = fakeOrganizations({
    items: [{ ...acme, environment }],
    selected: { id: acme.id, environment },
  })
}

test('writes only the token for production', async () => {
  selectEnvironment('production')
  const file = join(dir, '.env')
  const { promise } = run(['--env-file', file])
  await promise

  expect(await readFile(file, 'utf8')).toBe(
    'POLAR_ACCESS_TOKEN=polar_oat_secret\n',
  )
})

test('writes the local API URL for a local session', async () => {
  selectEnvironment('local')
  const file = join(dir, '.env')
  const { promise, output } = run(['--env-file', file])
  await promise

  expect(await readFile(file, 'utf8')).toBe(
    'POLAR_ACCESS_TOKEN=polar_oat_secret\nPOLAR_API_URL=http://127.0.0.1:8000\n',
  )
  expect(output()).toContain('serverURL: process.env.POLAR_API_URL')
})

test('warns about environment variables left from another environment', async () => {
  selectEnvironment('production')
  const file = join(dir, '.env')
  await writeFile(file, 'POLAR_ENVIRONMENT=sandbox\n')
  const { promise, output } = run(['--env-file', file])
  await promise

  expect(await readFile(file, 'utf8')).toBe(
    'POLAR_ENVIRONMENT=sandbox\nPOLAR_ACCESS_TOKEN=polar_oat_secret\n',
  )
  expect(output()).toContain('POLAR_ENVIRONMENT in')
  expect(output()).toContain("doesn't match this production token")
})

test('prints only the variables with --stdout and writes no file', async () => {
  const file = join(dir, '.env')
  const { promise, output } = run(['--stdout', '--env-file', file])
  await promise

  expect(output().trim()).toBe(
    'POLAR_ACCESS_TOKEN=polar_oat_secret\nPOLAR_ENVIRONMENT=sandbox',
  )
  await expect(access(file)).rejects.toThrow()
})

test('includes the variables in JSON output with --stdout', async () => {
  const { promise, output } = run(['--stdout', '--json'])
  await promise

  expect(JSON.parse(output())).toMatchObject({
    destination: 'stdout',
    variables: [
      { name: 'POLAR_ACCESS_TOKEN', value: 'polar_oat_secret' },
      { name: 'POLAR_ENVIRONMENT', value: 'sandbox' },
    ],
  })
})
