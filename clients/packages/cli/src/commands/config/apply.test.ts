import { describe, expect, test, vi } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { apply } from '@/commands/config/apply'
import { formatProblems } from '@/utils/billing-config/problems'
import {
  type AppliedEntry,
  type ApplyResult,
  BillingConfigError,
  type ConfigIssue,
  type LoadedConfig,
  type PlanResult,
} from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { keys, runCli, stripAnsi } from '@/utils/test-utils/cli'
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

const created: AppliedEntry = {
  section: 'meters',
  id: 'tool-calls',
  action: 'created',
  diff: [],
}
const kept: AppliedEntry = {
  section: 'meters',
  id: 'tokens',
  action: 'unchanged',
  diff: [],
}

const run = async (
  plan: PlanResult,
  result: ApplyResult,
  args: ReadonlyArray<string> = [],
  options: Parameters<typeof runCli>[2] = {},
) => {
  const applied = vi.fn(() => Effect.succeed(result))
  const cli = runCli(apply, ['polar.json', ...args], options)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.succeed(config),
          plan: () => Effect.succeed(plan),
          apply: applied,
          pull: () => Effect.die('unused'),
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
    ),
  )
  return {
    output: stripAnsi(cli.output()),
    terminal: stripAnsi(cli.terminal()),
    failed: exit._tag === 'Failure',
    applied: applied.mock.calls.length,
    exit,
  }
}

const message = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit)
    ? Cause.squash(exit.cause) instanceof BillingConfigError
      ? (Cause.squash(exit.cause) as BillingConfigError).message
      : String(Cause.squash(exit.cause))
    : undefined

describe('polar config apply', () => {
  test('applies with --confirm and reports what was applied', async () => {
    const { output, failed, applied } = await run(
      { entries: [created, kept], issues: [] },
      { status: 'applied', entries: [created, kept] },
      ['--confirm'],
    )
    expect(failed).toBe(false)
    expect(applied).toBe(1)
    expect(output).toMatch(
      /╯\n\n {2}Summary\n {2}╭─+╮\n *│ {2}Organization {2}Acme *│\n *│ {2}Environment {3}sandbox *│\n *│ {2}File {10}polar\.json *│\n *│ {2}Changes {7}0 to change, 1 to add, 1 unchanged *│\n *│ {2}Issues {8}none *│\n {2}╰─+╯\n\n {2}Apply\n/,
    )
    expect(output).toMatch(
      /│ {2}\+ tool-calls *│\n *│ {6}events {7}all events *│\n *│ {6}aggregation {2}count *│/,
    )
    expect(output).toContain(
      'polar.json applied to Acme (sandbox): 2 entries (1 created, 0 updated, 1 unchanged)',
    )
    expect(output).toMatch(
      /╯\n\n {2}Apply\n {2}╭─+╮\n {2}│ {2}Applying 1 change \(\d+ms\) *│\n {2}╰─+╯\n {2}polar\.json applied to Acme/,
    )
  })

  test.each(['-c', '--aladåb'])(
    'also skips the question with %s',
    async (flag) => {
      const { failed, applied } = await run(
        { entries: [created], issues: [] },
        { status: 'applied', entries: [created] },
        [flag],
      )
      expect(failed).toBe(false)
      expect(applied).toBe(1)
    },
  )

  test('asks before applying and stops when declined', async () => {
    const { output, terminal, applied, exit } = await run(
      { entries: [created], issues: [] },
      { status: 'applied', entries: [created] },
      [],
      { interactive: true, input: [...keys.type('n'), keys.enter] },
    )
    expect(applied).toBe(0)
    expect(output).toContain('+ tool-calls')
    expect(terminal).toContain('y to apply  n to cancel')
    expect(message(exit)).toBe('Apply cancelled, nothing changed')
  })

  test('applies when confirmed', async () => {
    const { failed, applied, output } = await run(
      { entries: [created], issues: [] },
      { status: 'applied', entries: [created] },
      [],
      { interactive: true, input: [...keys.type('y'), keys.enter] },
    )
    expect(failed).toBe(false)
    expect(applied).toBe(1)
    expect(output).toContain('polar.json applied to Acme (sandbox): 1 entry')
  })

  test('needs --confirm when there is no terminal to ask', async () => {
    const { output, terminal, applied, exit } = await run(
      { entries: [created], issues: [] },
      { status: 'applied', entries: [created] },
    )
    expect(applied).toBe(0)
    expect(terminal).not.toContain('y to apply')
    expect(output).toContain('+ tool-calls')
    expect(message(exit)).toBe('Confirmation needed to apply to Acme (sandbox)')
  })

  test.each([
    ['a coding agent runs it', [], { CLAUDECODE: '1' }],
    ['--non-interactive is passed', ['--non-interactive'], {}],
  ])('does not prompt when %s', async (_, args, env) => {
    const { terminal, applied, exit } = await run(
      { entries: [created], issues: [] },
      { status: 'applied', entries: [created] },
      args,
      { interactive: true, env },
    )
    expect(applied).toBe(0)
    expect(terminal).not.toContain('y to apply')
    expect(message(exit)).toBe('Confirmation needed to apply to Acme (sandbox)')
  })

  test('does nothing when the config is already applied', async () => {
    const { output, failed, applied } = await run(
      { entries: [kept], issues: [] },
      { status: 'applied', entries: [kept] },
    )
    expect(failed).toBe(false)
    expect(applied).toBe(0)
    expect(output).toContain('Acme (sandbox) is up to date, nothing to apply')
  })

  test('still shows warnings when nothing changed', async () => {
    const warning: ConfigIssue = {
      severity: 'warning',
      code: 'unknown_event',
      path: 'meters.0.filter.clauses.0.value',
      message: 'No events with this name have been received yet.',
      got: '"tool_call"',
      location,
    }
    const { output, failed, applied } = await run(
      { entries: [kept], issues: [warning] },
      { status: 'applied', entries: [kept] },
    )
    expect(failed).toBe(false)
    expect(applied).toBe(0)
    expect(output).toContain(
      'Warning: No events named "tool_call" have been received yet',
    )
    expect(output).toContain('Acme (sandbox) is up to date, nothing to apply')
  })

  test.each([
    ['nothing changed', [kept], []],
    ['changes were applied', [created], ['--confirm']],
  ])(
    'includes plan warnings in --json output when %s',
    async (_, entries, args) => {
      const warning: ConfigIssue = {
        severity: 'warning',
        code: 'unknown_event',
        path: 'meters.0.filter.clauses.0.value',
        message: 'No events with this name have been received yet.',
        got: '"tool_call"',
        location,
      }
      const { output, failed } = await run(
        { entries, issues: [warning] },
        { status: 'applied', entries },
        [...args, '--json'],
      )
      expect(failed).toBe(false)
      expect(JSON.parse(output)).toMatchObject({
        file: 'polar.json',
        status: 'applied',
        issues: [{ severity: 'warning', code: 'unknown_event' }],
      })
    },
  )

  test('fails and shows the problems when the plan has errors', async () => {
    const issues: ConfigIssue[] = [
      {
        severity: 'error',
        code: 'meter_locked',
        path: 'meters.0.filter',
        message: 'Locked',
        location,
      },
    ]
    const { output, failed, applied } = await run(
      { entries: [created], issues },
      { status: 'rejected', issues },
      ['--confirm'],
    )
    expect(failed).toBe(true)
    expect(applied).toBe(0)
    expect(output).toContain('Error: Cannot change "filter" of meters.0')
    expect(output).toContain('Issues        1 error')
    expect(output).toContain('Fix the error above')
    expect(output).not.toContain('applied')
  })
})
