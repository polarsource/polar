import { describe, expect, test, vi } from 'vitest'
import { Effect } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { validate } from '@/commands/config/validate'
import {
  BillingConfigError,
  type Catalogs,
  type LoadedConfig,
  type PlanResult,
} from '@/schemas/BillingConfig'
import { Environment } from '@/services/api'
import { Auth } from '@/services/auth'
import type { CatalogOptions } from '@/services/billing-config/api'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const source = [
  '{',
  '  "meters": [',
  '    { "external_id": "tool-calls", "unit": 7 }',
  '  ],',
  '  "catalog_name": "v1"',
  '}',
].join('\n')

const config: LoadedConfig = {
  file: 'polar.json',
  source,
  input: JSON.parse(source),
  generated: false,
}

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const entries = [
  { section: 'meters', id: 'tool-calls', action: 'created' as const, diff: [] },
]

const warning = {
  severity: 'warning' as const,
  code: 'unknown_event',
  path: 'meters.0.filter.clauses.0.value',
  message: 'No events with this name have been received yet.',
  got: '"tool_call"',
  location: { line: 3, column: 23, length: 12 },
}

const locked = {
  severity: 'error' as const,
  code: 'meter_locked',
  path: 'meters.0.filter',
  message: 'Locked',
  location: { line: 3, column: 5, length: 1 },
}

const draft = { id: 'cat-draft', name: 'v1' }

const run = async (
  result: PlanResult,
  args: string[] = [],
  catalogs: Catalogs | null = { live: null, draft: null },
  againstDraft: PlanResult | BillingConfigError = { entries: [], issues: [] },
) => {
  const planned = vi.fn(
    (_config: unknown, _organization: unknown, options?: CatalogOptions) =>
      options?.catalogId === undefined
        ? Effect.succeed(result)
        : againstDraft instanceof BillingConfigError
          ? Effect.fail(againstDraft)
          : Effect.succeed(againstDraft),
  )
  const cli = runCli(validate, ['polar.json', ...args])
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          reset: () => Effect.die('unused'),
          generate: () => Effect.die('unused'),
          load: () => Effect.succeed(config),
          plan: planned,
          apply: () => Effect.die('unused'),
          init: () => Effect.die('unused'),
          install: () => Effect.die('unused'),
          disable: () => Effect.die('unused'),
          deprecations: () => Effect.die('unused'),
          prune: () => Effect.die('unused'),
          catalogs: () =>
            catalogs === null
              ? Effect.fail(new BillingConfigError({ message: 'Forbidden' }))
              : Effect.succeed(catalogs),
          publish: () => Effect.die('unused'),
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
      Effect.provideService(Environment, {}),
      Effect.provide(FetchHttpClient.layer),
    ),
  )
  return {
    output: stripAnsi(cli.output()),
    failed: exit._tag === 'Failure',
    planned: planned.mock.calls.map(([, , options]) => options?.catalogId),
  }
}

const TREE =
  /│ {2}\+ tool-calls *│\n *│ {6}events {7}all events *│\n *│ {6}aggregation {2}count *│/

describe('polar config validate', () => {
  test('shows the changes and succeeds with warnings', async () => {
    const { output, failed } = await run({ entries, issues: [warning] })
    expect(failed).toBe(false)
    expect(output).toMatch(
      /Summary\n {2}╭─+╮\n *│ {2}Organization {2}Acme *│\n *│ {2}Environment {3}sandbox *│\n *│ {2}File {10}polar\.json *│\n *│ {2}Changes {7}0 to change, 1 to add, 0 unchanged *│\n *│ {2}Issues {8}1 warning *│\n {2}╰─+╯\n\n {2}Next\n {2}╭─+╮\n *│ {2}Run polar config draft to save it to the draft\. *│\n {2}╰─+╯\n$/,
    )
    expect(output).toMatch(TREE)
    expect(output).toContain(
      'Warning: No events named "tool_call" have been received yet',
    )
    expect(output).toContain('Issues        1 warning')
    expect(output).toMatch(
      /^ {2}Preflight\n {2}╭─+╮\n {2}│ {2}Reading {4}polar\.json *│\n {2}│ {2}Found {6}1 meter *│\n {2}│ {2}Comparing {2}\d+ms *│\n {2}╰─+╯$/m,
    )
  })

  test('reports a config that can be applied as is', async () => {
    const { output, failed } = await run({ entries, issues: [] })
    expect(failed).toBe(false)
    expect(output).toContain('Changes       0 to change, 1 to add, 0 unchanged')
    expect(output).toMatch(
      /│ {2}Run polar config draft to save it to the draft\. *│\n {2}╰─+╯\n$/,
    )
  })

  test('shows removals and asks to apply them', async () => {
    const { output, failed } = await run({
      entries: [
        {
          section: 'products',
          id: 'legacy',
          action: 'removed',
          reason: 'missing',
          diff: [],
        },
      ],
      issues: [],
    })
    expect(failed).toBe(false)
    expect(output).toMatch(/│ {2}- legacy {2}not in config *│/)
    expect(output).toContain(
      'Changes       0 to change, 0 to add, 1 to remove, 0 unchanged',
    )
    expect(output).toContain('Run polar config draft to save it to the draft.')
  })

  test('shows the catalog change once, in the summary', async () => {
    const { output } = await run({
      entries,
      catalog: { before: { name: 'v1' }, name: 'v2' },
      issues: [],
    })
    expect(output).toMatch(
      /│ {2}Changes {7}0 to change, 1 to add, 0 unchanged *│\n *│ {2}Catalog {7}v1 \(live\) → v2 \(draft\) *│\n *│ {2}Issues/,
    )
    expect(output.match(/v1 \(live\) → v2/g)).toHaveLength(1)
  })

  test('shows the first catalog as replacing no live catalog', async () => {
    const { output } = await run({
      entries,
      catalog: { before: null, name: 'v1' },
      issues: [],
    })
    expect(output).toContain('Catalog       no live catalog → v1 (draft)')
  })

  test('asks to save again when the draft is missing changes', async () => {
    const { output } = await run(
      { entries, issues: [] },
      [],
      { live: { id: 'cat-live', name: 'v3' }, draft },
      { entries, issues: [] },
    )
    expect(output.replace(/ *│\n *│ +/g, ' ')).toContain(
      'The draft is missing some of these changes. Run polar config draft, then polar config publish.',
    )
  })

  test('asks to discard a draft with changes the file no longer has', async () => {
    const { output } = await run(
      {
        entries: [{ ...entries[0]!, action: 'unchanged' as const }],
        issues: [],
      },
      [],
      { live: { id: 'cat-live', name: 'v3' }, draft },
      { entries, issues: [] },
    )
    expect(output).not.toContain('up to date')
    expect(output.replace(/ *│\n *│ +/g, ' ')).toContain(
      "The draft has changes polar.json doesn't. Run polar config draft to discard them.",
    )
  })

  test('prints the live catalog and the draft as JSON, counting a renamed catalog as drift', async () => {
    const { output } = await run(
      { entries, catalog: { before: null, name: 'v1' }, issues: [] },
      ['--json'],
      { live: null, draft: { id: 'cat-draft', name: null } },
      { entries, issues: [] },
    )
    expect(JSON.parse(output)).toEqual({
      file: 'polar.json',
      entries,
      catalog: { before: null, name: 'v1' },
      issues: [],
      live: null,
      draft: {
        id: 'cat-draft',
        name: null,
        drift: [
          ...entries,
          {
            section: 'catalog',
            id: 'name',
            action: 'updated',
            diff: [{ field: 'name', before: null, after: 'v1' }],
          },
        ],
      },
    })
  })

  test('claims nothing about a draft it cannot compare', async () => {
    const failing = new BillingConfigError({ message: 'Unexpected' })
    const human = await run(
      { entries, issues: [] },
      [],
      { live: null, draft },
      failing,
    )
    const json = await run(
      { entries, issues: [] },
      ['--json'],
      { live: null, draft },
      failing,
    )
    expect(human.output.replace(/ *│\n *│ +/g, ' ')).toContain(
      "There's an unpublished draft. Run polar config draft, then polar config publish.",
    )
    expect(JSON.parse(json.output).draft).toEqual({ ...draft, drift: null })
  })

  test('leaves the catalogs out when they cannot be read', async () => {
    const { output, failed, planned } = await run(
      { entries, issues: [] },
      ['--json'],
      null,
    )
    expect(failed).toBe(false)
    expect(planned).toEqual([undefined])
    expect(JSON.parse(output)).toEqual({
      file: 'polar.json',
      entries,
      issues: [],
    })
  })

  test('fails on errors but still shows the changes and warnings', async () => {
    const { output, failed } = await run({
      entries,
      issues: [locked, warning],
    })
    expect(failed).toBe(true)
    expect(output).toMatch(TREE)
    expect(output).toContain('Error: Cannot change "filter" of meters.0')
    expect(output).toContain('Warning:')
    expect(output).toContain('Issues        1 error, 1 warning')
    expect(output).toContain(
      'Fix the error above, then run polar config validate again.',
    )
  })

  test('skips --pr-comment outside a pull request', async () => {
    const { output, failed } = await run({ entries, issues: [] }, [
      '--pr-comment',
    ])
    expect(failed).toBe(false)
    expect(output).toContain(
      'Not building a pull request, skipped --pr-comment.',
    )
  })
})
