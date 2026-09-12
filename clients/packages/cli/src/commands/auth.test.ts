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

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}
const beta: ActiveOrganization = {
  id: 'org-2',
  name: 'Beta',
  slug: 'beta',
  environment: 'production',
}

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
    const { promise, output } = run(['login', '--sandbox'])
    await promise

    expect(output()).toContain('Already logged in to sandbox')
    expect(output()).toContain('polar auth login --sandbox --new-session')
    expect(output()).toContain('polar auth login --production to sign in')
  })

  test('explains how to replace an existing production session', async () => {
    auth.state.replaced = false
    const { promise, output } = run(['login', '--production'])
    await promise

    expect(output()).toContain('Already logged in to production')
    expect(output()).toContain('polar auth login --production --new-session')
    expect(output()).toContain('polar auth login --sandbox to sign in')
  })

  test('asks for the environment when no flag is given', async () => {
    const { promise, output, terminal } = run(['login'], {
      interactive: true,
      input: [keys.down, keys.enter, keys.enter],
    })
    await promise

    expect(terminal()).toContain('Which environment do you want to log in to?')
    expect(output()).toContain('Logged in to Polar production')
  })

  test('requires a flag outside a terminal', async () => {
    const { promise } = run(['login'])

    await expect(promise).rejects.toThrow('Pass --sandbox or --production')
  })

  test('rejects both environment flags', async () => {
    const { promise } = run(['login', '--sandbox', '--production'])

    await expect(promise).rejects.toThrow('not both')
  })

  test('points at the dashboards when there are no organizations', async () => {
    organizations.state.items = []
    const { promise, output } = run(['login', '--sandbox'])
    await promise

    expect(output()).toContain('Logged in to Polar sandbox')
    expect(output()).toContain('No organizations yet')
    expect(output()).toContain('https://polar.sh')
    expect(output()).toContain('https://sandbox.polar.sh')
    expect(output()).toContain('polar auth org')
  })

  test('skips organization selection outside a terminal', async () => {
    const { promise, output } = run(['login', '--production'])
    await promise

    expect(output()).toContain('Logged in to Polar production')
    expect(output()).toContain(
      'Organization selection requires an interactive terminal',
    )
    expect(organizations.state.selected).toBeUndefined()
  })

  test('offers organizations from every environment after login', async () => {
    const { promise, output, terminal } = run(['login', '--sandbox'], {
      interactive: true,
      input: [keys.down, keys.enter],
    })
    await promise

    expect(terminal()).toContain('Select organization')
    expect(terminal()).toContain('Acme sandbox')
    expect(terminal()).toContain('Beta production')
    expect(organizations.state.selected).toEqual({
      id: 'org-2',
      environment: 'production',
    })
    expect(output()).toContain('Active organization Beta beta production')
  })
})

describe('auth whoami', () => {
  test('shows the sessions and the active organization', async () => {
    organizations.state.selected = { id: 'org-2', environment: 'production' }
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toMatch(/Logged in\s+sandbox, production/)
    expect(output()).toContain('Beta beta production')
    expect(output()).toContain('org-2')
    expect(output()).not.toContain('No active organization')
  })

  test('suggests choosing an organization when none is active', async () => {
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toContain('No active organization')
    expect(output()).toContain('polar auth org')
  })

  test('explains how to log in when there are no sessions', async () => {
    auth.state.sessions = []
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toContain('Not logged in')
    expect(output()).toContain('polar auth login --sandbox')
    expect(output()).toContain('polar auth login --production')
  })

  test('shows the only organization of a token override', async () => {
    auth.state.credential = overrideCredential()
    auth.state.environment = 'sandbox'
    organizations.state.items = [acme]
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toContain('POLAR_ACCESS_TOKEN')
    expect(output()).toMatch(/Environment\s+sandbox/)
    expect(output()).toContain('Acme acme')
    expect(output()).not.toContain('No active organization')
  })

  test('suggests the org flag for ambiguous token overrides', async () => {
    auth.state.credential = overrideCredential()
    const { promise, output } = run(['whoami'])
    await promise

    expect(output()).toMatch(/Environment\s+production/)
    expect(output()).toContain('No active organization')
    expect(output()).toContain('--org <id>')
  })
})

describe('auth list', () => {
  test('groups organizations by environment and marks the active one', async () => {
    organizations.state.selected = { id: 'org-1', environment: 'sandbox' }
    const { promise, output } = run(['list'])
    await promise

    expect(output()).toContain('Organizations in sandbox')
    expect(output()).toContain('● Acme  acme  org-1')
    expect(output()).toContain('Organizations in production')
    expect(output()).toContain('○ Beta  beta  org-2')
  })

  test('only shows environments with a session', async () => {
    auth.state.sessions = ['production']
    const { promise, output } = run(['list'])
    await promise

    expect(output()).not.toContain('Organizations in sandbox')
    expect(output()).toContain('Organizations in production')
  })

  test('mentions the token override', async () => {
    auth.state.credential = overrideCredential()
    const { promise, output } = run(['list'])
    await promise

    expect(output()).toContain('Organizations in production')
    expect(output()).toContain('via POLAR_ACCESS_TOKEN')
    expect(output()).not.toContain('Organizations in sandbox')
  })

  test('reports when no organizations are accessible', async () => {
    organizations.state.items = []
    const { promise, output } = run(['list'])
    await promise

    expect(output()).toContain('No accessible organizations')
  })

  test('explains how to log in when there are no sessions', async () => {
    auth.state.sessions = []
    const { promise, output } = run(['list'])
    await promise

    expect(output()).toContain('Not logged in')
  })
})

describe('auth org', () => {
  test('refuses to manage sessions under a token override', async () => {
    auth.state.credential = overrideCredential()
    const { promise } = run(['org'])

    await expect(promise).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
  })

  test('requires a session', async () => {
    auth.state.sessions = []
    const { promise } = run(['org'])

    await expect(promise).rejects.toThrow('Not logged in')
  })

  test('requires a terminal to select an organization', async () => {
    const { promise, output } = run(['org'])
    await promise

    expect(output()).toContain(
      'Organization selection requires an interactive terminal',
    )
  })

  test('marks the active organization in the prompt', async () => {
    organizations.state.selected = { id: 'org-1', environment: 'sandbox' }
    const { promise, output, terminal } = run(['org'], {
      interactive: true,
      input: [keys.enter],
    })
    await promise

    expect(terminal()).toContain('Acme sandbox (active)')
    expect(output()).toContain('Active organization Acme acme sandbox')
    expect(organizations.state.selected).toEqual({
      id: 'org-1',
      environment: 'sandbox',
    })
  })

  test('fails when the prompt is abandoned', async () => {
    const { promise } = run(['org'], { interactive: true })

    await expect(promise).rejects.toThrow()
    expect(organizations.state.selected).toBeUndefined()
  })
})

describe('auth logout', () => {
  test('logs out of the flagged environment only', async () => {
    const { promise, output } = run(['logout', '--production'])
    await promise

    expect(output()).toContain('Logged out of Polar production')
    expect(output()).not.toContain('sandbox')
    expect(auth.state.sessions).toEqual(['sandbox'])
  })

  test('logs out of everything with --all', async () => {
    const { promise, output } = run(['logout', '--all'])
    await promise

    expect(output()).toContain('Logged out of Polar sandbox')
    expect(output()).toContain('Logged out of Polar production')
    expect(auth.state.sessions).toEqual([])
  })

  test('reports environments that had no session', async () => {
    auth.state.sessions = ['sandbox']
    const { promise, output } = run(['logout', '--production'])
    await promise

    expect(output()).toContain('Already logged out of production')
  })

  test('asks which session to remove when no flag is given', async () => {
    const { promise, output, terminal } = run(['logout'], {
      interactive: true,
      input: [keys.down, keys.down, keys.enter],
    })
    await promise

    expect(terminal()).toContain('Which session do you want to log out of?')
    expect(terminal()).toContain('All sessions')
    expect(output()).toContain('Logged out of Polar sandbox')
    expect(output()).toContain('Logged out of Polar production')
  })

  test('requires a flag outside a terminal', async () => {
    const { promise } = run(['logout'])

    await expect(promise).rejects.toThrow(
      'Pass --sandbox, --production or --all',
    )
  })

  test('reports when there is nothing to log out of', async () => {
    auth.state.sessions = []
    const { promise, output } = run(['logout'], { interactive: true })
    await promise

    expect(output()).toContain('Already logged out')
  })

  test('warns that a token override stays active', async () => {
    auth.state.credential = overrideCredential()
    const { promise, output } = run(['logout', '--all'])
    await promise

    expect(output()).toContain('POLAR_ACCESS_TOKEN remains active')
    expect(output()).toContain('Logged out of Polar')
  })

  test('offers saved sessions interactively under a token override', async () => {
    auth.state.credential = overrideCredential()
    auth.state.environment = 'production'
    auth.state.sessions = ['sandbox']

    const { promise, output, terminal } = run(['logout'], {
      interactive: true,
      input: [keys.enter],
    })
    await promise

    expect(output()).toContain('POLAR_ACCESS_TOKEN remains active')
    expect(terminal()).toContain('Which session do you want to log out of?')
    expect(terminal()).toContain('Sandbox')
    expect(terminal()).not.toContain('Production')
    expect(output()).toContain('Logged out of Polar sandbox')
    expect(output()).not.toContain('Already logged out of production')
    expect(auth.state.sessions).toEqual([])
  })

  test('offers all saved sessions and the all option under a token override', async () => {
    auth.state.credential = overrideCredential()
    auth.state.environment = 'production'
    auth.state.sessions = ['sandbox', 'production']

    const { promise, output, terminal } = run(['logout'], {
      interactive: true,
      input: [keys.down, keys.down, keys.enter],
    })
    await promise

    expect(terminal()).toContain('Which session do you want to log out of?')
    expect(terminal()).toContain('All sessions')
    expect(output()).toContain('Logged out of Polar sandbox')
    expect(output()).toContain('Logged out of Polar production')
    expect(auth.state.sessions).toEqual([])
  })

  test('reports nothing to log out of under a token override with no saved sessions', async () => {
    auth.state.credential = overrideCredential()
    auth.state.environment = 'production'
    auth.state.sessions = []

    const { promise, output } = run(['logout'], {
      interactive: true,
    })
    await promise

    expect(output()).toContain('POLAR_ACCESS_TOKEN remains active')
    expect(output()).toContain('Already logged out')
  })
})
