import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { apply } from '@/commands/config/apply'
import { formatProblems } from '@/utils/billing-config/problems'
import type {
  ApplyResult,
  ConfigIssue,
  LoadedConfig,
} from '@/schemas/BillingConfig'
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

const location = { line: 3, column: 5, length: 1 }

describe('formatProblems', () => {
  test('titles missing keys, unknown keys, locked fields and value errors', () => {
    const issues: ConfigIssue[] = [
      {
        severity: 'error',
        code: 'missing',
        path: 'meters.0.name',
        message: 'Field required',
        location,
      },
      {
        severity: 'error',
        code: 'extra_forbidden',
        path: 'meters.0.lable',
        message: 'Extra inputs are not permitted',
        location,
      },
      {
        severity: 'error',
        code: 'extra_forbidden',
        path: 'meter',
        message: 'Extra inputs are not permitted',
        location,
      },
      {
        severity: 'error',
        code: 'meter_locked',
        path: 'meters.0.filter',
        message:
          "This field can't be updated because the meter is already aggregating events.",
        location,
      },
      {
        severity: 'error',
        code: 'value_error',
        path: 'meters',
        message: 'Value error, Duplicate external_id values: x.',
        location,
      },
      {
        severity: 'error',
        code: 'duplicate_external_id',
        path: 'meters.1.external_id',
        message: 'Duplicate external_id.',
        got: '"x"',
        location,
      },
      {
        severity: 'error',
        code: 'enum',
        path: 'meters.0.unit',
        message: "Input should be 'scalar', 'token' or 'custom'",
        got: '7',
      },
    ]
    const output = stripAnsi(formatProblems(config, issues))
    expect(output).toContain('Error: Missing "name" in meters.0')
    expect(output).toContain('╰── "name" should be set here')
    expect(output).toContain('Error: Unknown key "lable" in meters.0')
    expect(output).toContain('Error: Unknown section "meter"')
    expect(output).toContain('Error: Cannot change "filter" of meters.0')
    expect(output).toContain('╰── the meter is already aggregating events')
    expect(output).toContain('Error: Duplicate external_id values: x.')
    expect(output).toContain('Error: Duplicate external_id "x"')
    expect(output).toContain('╰── already used by another entry')
    expect(output).toContain('Error: Invalid value for "unit" at meters.0.unit')
    expect(output).toContain('help: Got 7.')
  })
})

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const run = async (result: ApplyResult) => {
  const cli = runCli(apply, ['polar.json'])
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.succeed(config),
          plan: () => Effect.die('unused'),
          pull: () => Effect.die('unused'),
          save: () => Effect.die('unused'),
          apply: () => Effect.succeed(result),
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

describe('polar config apply', () => {
  test('reports what was applied', async () => {
    const { output, failed } = await run({
      status: 'applied',
      entries: [
        { section: 'meters', id: 'tool-calls', action: 'created', diff: [] },
        { section: 'meters', id: 'tokens', action: 'unchanged', diff: [] },
      ],
    })
    expect(failed).toBe(false)
    expect(output).toContain('+ tool-calls  created')
    expect(output).toContain(
      'polar.json applied: 2 entries (1 created, 0 updated, 1 unchanged)',
    )
    expect(output).toMatch(/Applying config \d+ms/)
  })

  test('fails and shows the problems when the config is rejected', async () => {
    const { output, failed } = await run({
      status: 'rejected',
      issues: [
        {
          severity: 'error',
          code: 'meter_locked',
          path: 'meters.0.filter',
          message: 'Locked',
          location,
        },
      ],
    })
    expect(failed).toBe(true)
    expect(output).toContain('Error: Cannot change "filter" of meters.0')
    expect(output).toContain('Found 1 error.')
    expect(output).not.toContain('applied:')
  })
})
