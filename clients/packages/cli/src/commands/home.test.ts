import { describe, expect, test } from 'vitest'
import { Console, Effect } from 'effect'
import { home } from '@/commands/home'
import { AuthError, type ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import { captureConsole } from '@/utils/test-utils/cli'
import {
  fakeAuth,
  fakeOrganizations,
  overrideCredential,
} from '@/utils/test-utils/services'
import { VERSION } from '@/version'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const render = (
  auth: ReturnType<typeof fakeAuth>,
  organizations: ReturnType<typeof fakeOrganizations>,
) => {
  const { lines, console } = captureConsole()
  return Effect.runPromise(
    home.pipe(
      Effect.provideService(Auth, auth.auth),
      Effect.provideService(Organizations, organizations.organizations),
      Effect.provideService(Console.Console, console),
    ),
  ).then(() => lines.join('\n'))
}

describe('home', () => {
  test('points a new user at login', async () => {
    const output = await render(fakeAuth({ sessions: [] }), fakeOrganizations())

    expect(output).toContain(`Polar CLI ${VERSION}`)
    expect(output).toContain('Not logged in')
    expect(output).toContain('polar auth login --sandbox')
    expect(output).not.toContain('Try next')
    expect(output).toContain('polar --help')
  })

  test('shows the session, the active organization and what to try next', async () => {
    const output = await render(
      fakeAuth({ sessions: ['sandbox'] }),
      fakeOrganizations({
        items: [acme],
        selected: { id: 'org-1', environment: 'sandbox' },
      }),
    )

    expect(output).toContain('Logged in     sandbox')
    expect(output).toContain('Organization  Acme sandbox')
    expect(output).toContain('polar listen 3000')
    expect(output).toContain('polar trigger order.paid')
    expect(output).toContain('polar auth org')
  })

  test('asks for an organization when none is active', async () => {
    const output = await render(
      fakeAuth({ sessions: ['sandbox'] }),
      fakeOrganizations({ items: [acme] }),
    )

    expect(output).toContain('No active organization')
    expect(output).toContain('Run polar auth org to choose one')
  })

  test('describes a token override without suggesting a session switch', async () => {
    const output = await render(
      fakeAuth({ credential: overrideCredential(), environment: 'sandbox' }),
      fakeOrganizations({ items: [acme] }),
    )

    expect(output).toContain('POLAR_ACCESS_TOKEN')
    expect(output).toContain('Organization  Acme sandbox')
    expect(output).not.toContain('Switch organization')
  })

  test('still renders when the organization cannot be loaded', async () => {
    const output = await render(
      fakeAuth({ sessions: ['sandbox'] }),
      fakeOrganizations({
        selected: { id: 'org-gone', environment: 'sandbox' },
      }),
    )

    expect(output).toContain('Organization  could not be loaded')
    expect(output).toContain('Try next')
  })

  test('still renders when the saved session cannot be read', async () => {
    const output = await render(
      fakeAuth({ failure: new AuthError({ message: 'Keyring locked' }) }),
      fakeOrganizations(),
    )

    expect(output).toContain('Could not read your saved session')
    expect(output).toContain('polar auth whoami')
    expect(output).toContain('polar --help')
  })
})
