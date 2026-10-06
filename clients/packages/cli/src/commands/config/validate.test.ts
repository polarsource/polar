import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { formatProblems, validate } from '@/commands/config/validate'
import type { ConfigIssue, LoadedConfig } from '@/schemas/Config'
import { Auth } from '@/services/auth'
import { Config } from '@/services/config'
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

const unitIssue: ConfigIssue = {
  severity: 'error',
  code: 'literal_error',
  path: 'meters.0.unit',
  message: "Input should be 'scalar', 'token' or 'custom'",
  got: '7',
  location: { line: 3, column: 43, length: 1 },
}

const warning: ConfigIssue = {
  severity: 'warning',
  code: 'unknown_event',
  path: 'meters.0.filter.clauses.0.value',
  message: 'No "nope" events have been received yet',
  location: { line: 3, column: 23, length: 12 },
}

describe('formatProblems', () => {
  test('renders each problem with a framed source excerpt', () => {
    const output = stripAnsi(formatProblems(config, [unitIssue, warning]))
    expect(output).toContain('Error: Invalid value for "unit" at meters.0.unit')
    expect(output).toContain('╭─[polar.json:3:43]')
    expect(output).toContain(
      '3 │     { "external_id": "tool-calls", "unit": 7 }',
    )
    expect(output).toContain("╰── expected 'scalar', 'token' or 'custom'")
    expect(output).toContain('╰────')
    expect(output).toContain('Warning: No "nope" events have been received yet')
    expect(output).toContain('╰── no events with this name yet')
  })

  test('explains a missing key', () => {
    const output = stripAnsi(
      formatProblems(config, [
        {
          severity: 'error',
          code: 'missing',
          path: 'meters.0.aggregation.property',
          message: 'Field required',
          location: { line: 3, column: 5, length: 40 },
        },
      ]),
    )
    expect(output).toContain(
      'Error: Missing "property" in meters.0.aggregation',
    )
    expect(output).toContain('╰── "property" should be set here')
  })

  test('titles unknown keys, sections, duplicates and a non-object root', () => {
    const location = { line: 3, column: 5, length: 1 }
    const titles = stripAnsi(
      formatProblems(config, [
        {
          severity: 'error',
          code: 'extra_forbidden',
          path: 'meters.0.lable',
          message: 'Extra inputs are not permitted',
          location,
        },
        {
          severity: 'error',
          code: 'unknown_section',
          path: 'meter',
          message: 'Unknown section "meter"',
          location,
        },
        {
          severity: 'error',
          code: 'duplicate_external_id',
          path: 'meters.1.external_id',
          message: '"x" is already used by meters.0',
          got: '"x"',
          location,
        },
        {
          severity: 'error',
          code: 'dict_type',
          path: '',
          message: 'Config should be an object',
          location,
        },
      ]),
    )
    expect(titles).toContain('Error: Unknown key "lable" in meters.0')
    expect(titles).toContain('Error: Unknown section "meter"')
    expect(titles).toContain('Error: Duplicate external_id "x"')
    expect(titles).toContain('╰── "x" is already used by meters.0')
    expect(titles).toContain('Error: Config should be an object')
  })

  test('falls back to a help line without a location', () => {
    const output = stripAnsi(
      formatProblems(config, [{ ...unitIssue, location: undefined }]),
    )
    expect(output).toContain('help: Got 7.')
    expect(output).not.toContain('╭─[')
  })
})

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const run = async (issues: ConfigIssue[]) => {
  const cli = runCli(validate, ['polar.json'])
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        Config,
        Config.of({
          load: () => Effect.succeed(config),
          validate: () => Effect.succeed(issues),
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

describe('polar config validate', () => {
  test('succeeds and counts warnings', async () => {
    const { output, failed } = await run([warning])
    expect(failed).toBe(false)
    expect(output).toContain('Warning: No "nope" events have been received yet')
    expect(output).toContain('Found 0 errors and 1 warning.')
    expect(output).toMatch(
      /Finished in \d+ms on polar.json with 1 meter\. Checked against Acme \(sandbox\)\./,
    )
  })

  test('reports a clean file', async () => {
    const { output, failed } = await run([])
    expect(failed).toBe(false)
    expect(output).toContain('polar.json is valid: 1 meter')
  })

  test('fails on errors but still shows warnings', async () => {
    const { output, failed } = await run([unitIssue, warning])
    expect(failed).toBe(true)
    expect(output).toContain('Error: Invalid value for "unit" at meters.0.unit')
    expect(output).toContain('Warning: No "nope" events have been received yet')
  })
})
