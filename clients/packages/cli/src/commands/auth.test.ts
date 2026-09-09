import { beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { auth as authCommand } from '@/commands/auth'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import { keys, runCli, type RunCliOptions } from '@/utils/test-utils/cli'
import {
  fakeAuth,
  fakeOrganizations,
  overrideCredential,
} from '@/utils/test-utils/services'

const acme: ActiveOrganization = { id: 'org-1', name: 'Acme', slug: 'acme' }
const beta: ActiveOrganization = { id: 'org-2', name: 'Beta', slug: 'beta' }

let auth: ReturnType<typeof fakeAuth>
let organizations: ReturnType<typeof fakeOrganizations>

const run = (args: string[], options?: RunCliOptions) => {
  const cli = runCli(authCommand, args, options)
  const promise = Effect.runPromise(
    cli.effect.pipe(
      Effect.provideService(Auth, auth.auth),
      Effect.provideService(Organizations, organizations.organizations),
    ),
  )
  return { promise, output: cli.output, terminal: cli.terminal }
}

beforeEach(() => {
  auth = fakeAuth()
  organizations = fakeOrganizations({ items: [acme, beta] })
})

describe('auth login', () => {
  test('explains how to replace an existing sandbox session', async () => {
    auth.state.replaced = false
    const { promise, output } = run(['login'])
    await promise

    expect(output()).toContain('Already logged in to sandbox')
    expect(output()).toContain('polar auth login --new-session')
    expect(output()).toContain('polar auth login --production to sign in')
  })

  test('explains how to replace an existing production session', async () => {
    auth.state.replaced = false
    const { promise, output } = run(['login', '--production'])
    await promise

    expect(output()).toContain('Already logged in to production')
    expect(output()).toContain('polar auth login --production --new-session')
    expect(output()).toContain('polar auth login to sign in to sandbox')
  })

  test('points at the dashboard when there are no organizations', async () => {
    organizations.state.items = []
    const { promise, output } = run(['login'])
    await promise

    expect(output()).toContain('Logged in to Polar sandbox')
    expect(output()).toContain('No organizations in sandbox yet')
    expect(output()).toContain('https://sandbox.polar.sh')
    expect(output()).toContain('polar auth org')
  })

  test('points at the production dashboard for production logins', async () => {
    organizations.state.items = []
    const { promise, output } = run(['login', '--production'])
    await promise

    expect(output()).toContain('No organizations in production yet')
    expect(output()).toContain('https://polar.sh')
    expect(output()).toContain('polar auth org --production')
  })

  test('skips organization selection outside a terminal', async () => {
    const { promise, output } = run(['login'])
    await promise

    expect(output()).toContain('Logged in to Polar sandbox')
    expect(output()).toContain(
      'Organization selection requires an interactive terminal',
    )
    expect(organizations.state.selected).toEqual({})
  })

  test('selects an organization interactively', async () => {
    const { promise, output, terminal } = run(['login'], {
      interactive: true,
      input: [keys.down, keys.enter],
    })
    await promise

    expect(terminal()).toContain('Select sandbox organization')
    expect(organizations.state.selected).toEqual({ sandbox: 'org-2' })
    expect(output()).toContain('Active organization Beta beta')
  })
})

describe('auth whoami', () => {
  test('shows the active organization of a saved session', async () => {
    organizations.state.selected = { sandbox: 'org-2' }
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toContain('sandbox')
    expect(output()).toContain('Beta beta')
    expect(output()).toContain('org-2')
    expect(output()).not.toContain('No active organization')
  })

  test('suggests choosing an organization when none is active', async () => {
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toContain('No active organization')
    expect(output()).toContain('polar auth org')
  })

  test('shows the only organization of a token override', async () => {
    auth.state.credential = overrideCredential()
    organizations.state.items = [acme]
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toContain('POLAR_ACCESS_TOKEN')
    expect(output()).toContain('Acme acme')
    expect(output()).not.toContain('No active organization')
  })

  test('suggests the org flag for ambiguous token overrides', async () => {
    auth.state.credential = overrideCredential()
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toContain('No active organization')
    expect(output()).toContain('--org <id>')
  })
})

describe('auth list', () => {
  test('marks the active organization', async () => {
    organizations.state.selected = { sandbox: 'org-1' }
    const { promise, output } = run(['list'])
    await promise

    expect(output()).toContain('Organizations in sandbox')
    expect(output()).toContain('● Acme  acme  org-1')
    expect(output()).toContain('○ Beta  beta  org-2')
  })

  test('mentions the token override', async () => {
    auth.state.credential = overrideCredential()
    const { promise, output } = run(['list', '--production'])
    await promise

    expect(output()).toContain('Organizations in production')
    expect(output()).toContain('via POLAR_ACCESS_TOKEN')
  })

  test('reports when no organizations are accessible', async () => {
    organizations.state.items = []
    const { promise, output } = run(['list'])
    await promise

    expect(output()).toContain('No accessible organizations')
  })
})

describe('auth org', () => {
  test('refuses to manage sessions under a token override', async () => {
    auth.state.credential = overrideCredential()
    const { promise } = run(['org'])

    await expect(promise).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
  })

  test('requires a terminal to select an organization', async () => {
    const { promise, output } = run(['org'])
    await promise

    expect(output()).toContain(
      'Organization selection requires an interactive terminal',
    )
  })

  test('marks the active organization in the prompt', async () => {
    organizations.state.selected = { sandbox: 'org-1' }
    const { promise, output, terminal } = run(['org'], {
      interactive: true,
      input: [keys.enter],
    })
    await promise

    expect(terminal()).toContain('Acme (active)')
    expect(output()).toContain('Active organization Acme acme')
    expect(organizations.state.selected).toEqual({ sandbox: 'org-1' })
  })

  test('fails when the prompt is abandoned', async () => {
    const { promise } = run(['org'], { interactive: true })

    await expect(promise).rejects.toThrow()
    expect(organizations.state.selected).toEqual({})
  })
})

describe('auth logout', () => {
  test('confirms the session was removed', async () => {
    const { promise, output } = run(['logout'])
    await promise

    expect(output()).toContain('Logged out of Polar sandbox')
  })

  test('reports when there was no session', async () => {
    auth.state.deleted = false
    const { promise, output } = run(['logout', '--production'])
    await promise

    expect(output()).toContain('Already logged out of production')
  })

  test('warns that a token override stays active', async () => {
    auth.state.credential = overrideCredential()
    const { promise, output } = run(['logout'])
    await promise

    expect(output()).toContain('POLAR_ACCESS_TOKEN remains active')
    expect(output()).toContain('Logged out of Polar sandbox')
  })
})
