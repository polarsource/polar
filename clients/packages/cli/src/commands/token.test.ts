import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Redacted } from 'effect'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { token as tokenCommand } from '@/commands/token'
import type { ActiveOrganization } from '@/schemas/Auth'
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
          receive: (request) =>
            Effect.sync(() => {
              requests.push(request)
              return Redacted.make('polar_oat_secret')
            }),
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
    '--name',
    'my-app',
  ])
  await promise

  expect(await readFile(file, 'utf8')).toBe(
    'OTHER=1\nPOLAR_ACCESS_TOKEN=polar_oat_secret\n',
  )
  expect(requests).toEqual([
    {
      organization: { slug: 'acme', environment: 'sandbox' },
      name: 'my-app',
      scopes: ['products:read', 'checkouts:write'],
    },
  ])
  expect(output()).toContain('Updated POLAR_ACCESS_TOKEN')
  expect(output()).not.toContain('polar_oat_secret')
})

test('creates the env file under a custom variable name', async () => {
  const file = join(dir, '.env.local')
  const { promise, output } = run([
    '--env-file',
    file,
    '--env-var',
    'POLAR_OAT',
  ])
  await promise

  expect(await readFile(file, 'utf8')).toBe('POLAR_OAT=polar_oat_secret\n')
  expect(output()).toContain('Added POLAR_OAT')
})

test('rejects an invalid variable name before creating a token', async () => {
  const { promise } = run(['--env-file', join(dir, '.env'), '--env-var', 'A=B'])
  await expect(promise).rejects.toThrow('not a valid environment variable name')
  expect(requests).toEqual([])
})
