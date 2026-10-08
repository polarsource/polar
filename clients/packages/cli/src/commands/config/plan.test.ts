import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { plan } from '@/commands/config/plan'
import type { LoadedConfig, PlanResult } from '@/schemas/BillingConfig'
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

const run = async (result: PlanResult) => {
  const cli = runCli(plan, ['polar.json'])
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.succeed(config),
          plan: () => Effect.succeed(result),
          apply: () => Effect.die('unused'),
          pull: () => Effect.die('unused'),
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
  return { output: stripAnsi(cli.output()), failed: exit._tag === 'Failure' }
}

describe('polar config plan', () => {
  test('shows the changes and succeeds with warnings', async () => {
    const { output, failed } = await run({ entries, issues: [warning] })
    expect(failed).toBe(false)
    expect(output).toContain('+ tool-calls  will be created')
    expect(output).toContain(
      'Warning: No events named "tool_call" have been received yet',
    )
    expect(output).toContain('Found 0 errors and 1 warning.')
    expect(output).toMatch(/Checking config \d+ms/)
  })

  test('reports a config that can be applied as is', async () => {
    const { output, failed } = await run({ entries, issues: [] })
    expect(failed).toBe(false)
    expect(output).toContain('polar.json can be applied')
  })

  test('fails on errors but still shows the changes and warnings', async () => {
    const { output, failed } = await run({
      entries,
      issues: [locked, warning],
    })
    expect(failed).toBe(true)
    expect(output).toContain('+ tool-calls  will be created')
    expect(output).toContain('Error: Cannot change "filter" of meters.0')
    expect(output).toContain('Warning:')
    expect(output).toContain('Found 1 error and 1 warning.')
  })
})
