import { describe, expect, test, vi } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { publish } from '@/commands/config/publish'
import {
  BillingConfigError,
  type Catalog,
  type Catalogs,
} from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { keys, runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const withDraft: Catalogs = {
  live: { id: 'cat-live', name: 'v3' },
  draft: { id: 'cat-draft', name: null },
}

const run = async (
  catalogs: Catalogs,
  args: ReadonlyArray<string> = [],
  options: Parameters<typeof runCli>[2] = {},
) => {
  const published = vi.fn((_organization: unknown, draft: Catalog) =>
    Effect.succeed({ ...draft, name: 'v4' }),
  )
  const cli = runCli(publish, args, options)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.die('unused'),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          prune: () => Effect.die('unused'),
          catalogs: () => Effect.succeed(catalogs),
          publish: published,
        }),
      ),
      Effect.provideService(Auth, fakeAuth().auth),
      Effect.provideService(
        Organizations,
        fakeOrganizations({
          items: [acme],
          selected: { id: acme.id, environment: acme.environment },
        }).organizations,
      ),
    ),
  )
  return {
    output: stripAnsi(cli.output()),
    published: published.mock.calls.map(([, draft]) => draft.id),
    message: Exit.isFailure(exit)
      ? (Cause.squash(exit.cause) as BillingConfigError).message
      : undefined,
  }
}

describe('polar config publish', () => {
  test('publishes the draft with --confirm', async () => {
    const { output, published, message } = await run(withDraft, ['--confirm'])
    expect(message).toBeUndefined()
    expect(published).toEqual(['cat-draft'])
    expect(output).toMatch(/Catalog {7}v3 → draft/)
    expect(output).toContain(
      'v4 is live for Acme (sandbox). Existing customers stay on their current versions.',
    )
  })

  test('says so when there is no draft', async () => {
    const { output, published, message } = await run(
      { live: withDraft.live, draft: null },
      ['--confirm'],
    )
    expect(message).toBeUndefined()
    expect(published).toEqual([])
    expect(output).toContain('No draft to publish for Acme (sandbox)')
  })

  test('needs --confirm when there is no terminal to ask', async () => {
    const { published, message } = await run(withDraft)
    expect(published).toEqual([])
    expect(message).toBe('Confirmation needed to publish to Acme (sandbox)')
  })

  test('stops when declined', async () => {
    const { published, message } = await run(withDraft, [], {
      interactive: true,
      input: [...keys.type('n'), keys.enter],
    })
    expect(published).toEqual([])
    expect(message).toBe('Publish cancelled, nothing changed')
  })

  test('prints the catalogs as JSON', async () => {
    const { output } = await run(withDraft, ['--confirm', '--json'])
    expect(JSON.parse(output)).toEqual({
      live: { id: 'cat-live', name: 'v3' },
      draft: { id: 'cat-draft', name: 'v4' },
      published: true,
    })
  })
})
