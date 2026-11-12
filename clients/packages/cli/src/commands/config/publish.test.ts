import { describe, expect, test, vi } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { publish } from '@/commands/config/publish'
import {
  type AppliedEntry,
  BillingConfigError,
  type Catalog,
  type Catalogs,
  type ConfigIssue,
  type LoadedConfig,
  NO_CONFIG_FILE,
} from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import type { CatalogOptions } from '@/services/billing-config/api'
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

const config: LoadedConfig = {
  file: 'polar.json',
  source: '{"products":[{"external_id":"pro"}]}',
  input: { products: [{ external_id: 'pro' }] },
  generated: false,
}

const repriced: AppliedEntry = {
  section: 'products',
  id: 'pro',
  action: 'updated',
  diff: [{ field: 'name', before: 'Pro', after: 'Pro plus' }],
}

const run = async (
  catalogs: Catalogs,
  args: ReadonlyArray<string> = [],
  options: Parameters<typeof runCli>[2] = {},
  entries: ReadonlyArray<AppliedEntry> | null = [],
  issues: ReadonlyArray<ConfigIssue> = [],
) => {
  const planned = vi.fn(
    (_config: unknown, _organization: unknown, _options?: CatalogOptions) =>
      Effect.succeed({ entries: entries ?? [], issues }),
  )
  const published = vi.fn((_organization: unknown, draft: Catalog) =>
    Effect.succeed({ ...draft, name: 'v4' }),
  )
  const cli = runCli(publish, args, options)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () =>
            entries === null
              ? Effect.fail(new BillingConfigError({ message: NO_CONFIG_FILE }))
              : Effect.succeed(config),
          plan: planned,
          apply: () => Effect.die('unused'),
          deprecations: () => Effect.die('unused'),
          prune: () => Effect.die('unused'),
          catalogs: () => Effect.succeed(catalogs),
          publish: published,
          init: () => Effect.die('unused'),
          install: () => Effect.die('unused'),
          disable: () => Effect.die('unused'),
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
    terminal: stripAnsi(cli.terminal()),
    published: published.mock.calls.map(([, draft]) => draft.id),
    planned: planned.mock.calls.map(([, , options]) => options?.catalogId),
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

  test('compares the config file with the draft', async () => {
    const { output, planned } = await run(withDraft, ['--confirm'])
    expect(planned).toEqual(['cat-draft'])
    expect(output).toContain('polar.json matches the draft')
    expect(output).not.toContain('Not in the draft')
  })

  test('shows changes in the config file that the draft is missing', async () => {
    const { output, published } = await run(withDraft, ['--confirm'], {}, [
      repriced,
      { section: 'meters', id: 'tokens', action: 'updated', diff: [] },
      { section: 'benefits', id: 'support', action: 'unchanged', diff: [] },
    ])
    expect(published).toEqual(['cat-draft'])
    expect(output).toContain('polar.json has 2 changes not in the draft')
    expect(output).toContain('Not in the draft polar.json')
    expect(output).toMatch(/~ pro/)
    expect(output).toMatch(/~ tokens/)
    expect(output).not.toContain('support')
  })

  test('warns in the confirmation when the draft is missing changes', async () => {
    const { terminal } = await run(
      withDraft,
      [],
      { interactive: true, input: [...keys.type('n'), keys.enter] },
      [repriced],
    )
    expect(terminal).toContain(
      'Warning: polar.json has changes that are not in the draft.',
    )
  })

  test('publishes without comparing when there is no config file', async () => {
    const { output, published, planned } = await run(
      withDraft,
      ['--confirm'],
      {},
      null,
    )
    expect(planned).toEqual([])
    expect(published).toEqual(['cat-draft'])
    expect(output).toContain('skipped, no config file found')
  })

  test('stops when a named config file is missing', async () => {
    const { published, message } = await run(
      withDraft,
      ['billing.json', '--confirm'],
      {},
      null,
    )
    expect(published).toEqual([])
    expect(message).toBe(NO_CONFIG_FILE)
  })

  test('stops when the config file has errors', async () => {
    const { published, message } = await run(
      withDraft,
      ['--confirm'],
      {},
      [],
      [
        {
          severity: 'error',
          code: 'missing',
          path: 'products.0.name',
          message: 'Field required',
          location: { line: 1, column: 2, length: 1 },
        },
      ],
    )
    expect(published).toEqual([])
    expect(message).toBe(
      'Could not compare polar.json with the draft, it has 1 error',
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
    const { terminal, published, message } = await run(withDraft, [], {
      interactive: true,
      input: [...keys.type('n'), keys.enter],
    })
    expect(published).toEqual([])
    expect(terminal).toContain('y to publish  n to cancel')
    expect(message).toBe('Publish cancelled, nothing changed')
  })

  test('prints the catalogs as JSON', async () => {
    const { output } = await run(withDraft, ['--confirm', '--json'])
    expect(JSON.parse(output)).toEqual({
      live: { id: 'cat-draft', name: 'v4' },
      draft: null,
      published: true,
      drift: [],
    })
  })
})
