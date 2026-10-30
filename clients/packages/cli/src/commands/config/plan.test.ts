import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { plan } from '@/commands/config/plan'
import type { LoadedConfig, PlanResult } from '@/schemas/BillingConfig'
import { Environment } from '@/services/api'
import { Auth } from '@/services/auth'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const source = [
  '{',
  '  "meters": [',
  '    { "external_id": "tool-calls", "unit": 7 }',
  '  ]',
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

const run = async (result: PlanResult, args: string[] = []) => {
  const cli = runCli(plan, ['polar.json', ...args])
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.succeed(config),
          plan: () => Effect.succeed(result),
          apply: () => Effect.die('unused'),
          prune: () => Effect.die('unused'),
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
  return { output: stripAnsi(cli.output()), failed: exit._tag === 'Failure' }
}

const TREE =
  /│ {2}\+ tool-calls *│\n *│ {6}events {7}all events *│\n *│ {6}aggregation {2}count *│/

describe('polar config plan', () => {
  test('shows the changes and succeeds with warnings', async () => {
    const { output, failed } = await run({ entries, issues: [warning] })
    expect(failed).toBe(false)
    expect(output).toMatch(
      /Summary\n {2}╭─+╮\n *│ {2}Organization {2}Acme *│\n *│ {2}Environment {3}sandbox *│\n *│ {2}File {10}polar\.json *│\n *│ {2}Changes {7}0 to change, 1 to add, 0 unchanged *│\n *│ {2}Issues {8}1 warning *│\n {2}╰─+╯\n\n {2}Next\n {2}╭─+╮\n *│ {2}Run polar config apply to apply it\. *│\n {2}╰─+╯\n$/,
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
      /│ {2}Run polar config apply to apply it\. *│\n {2}╰─+╯\n$/,
    )
  })

  test('shows the catalog change once, in the summary', async () => {
    const { output } = await run({
      entries,
      catalog: { before: { name: 'v1' }, name: 'v2' },
      issues: [],
    })
    expect(output).toMatch(
      /│ {2}Changes {7}0 to change, 1 to add, 0 unchanged *│\n *│ {2}Catalog {7}v1 → v2 *│\n *│ {2}Issues/,
    )
    expect(output.match(/v1 → v2/g)).toHaveLength(1)
  })

  test('shows the first catalog as replacing none', async () => {
    const { output } = await run({
      entries,
      catalog: { before: null, name: 'v1' },
      issues: [],
    })
    expect(output).toContain('Catalog       none → v1')
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
      'Fix the error above, then run polar config plan again.',
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
