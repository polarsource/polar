import { describe, expect, test } from 'vitest'
import type { ConfigIssue, LoadedConfig } from '@/schemas/BillingConfig'
import { formatProblems } from '@/utils/billing-config/problems'
import { stripAnsi } from '@/utils/test-utils/cli'

const generated: LoadedConfig = {
  file: 'polar.config.ts',
  source: '{\n  "meters": []\n}',
  input: { meters: [] },
  generated: true,
}

const warning: ConfigIssue = {
  severity: 'warning',
  code: 'unknown_event',
  path: 'meters.tool_calls.filter.clauses.0.value',
  message: 'No events with this name have been received yet.',
  got: '"tool_call"',
}

const locked: ConfigIssue = {
  severity: 'error',
  code: 'meter_locked',
  path: 'meters.tool_calls.filter',
  message: 'Locked',
}

const invalid: ConfigIssue = {
  severity: 'error',
  code: 'string_type',
  path: 'meters.tool_calls.name',
  message: 'Input should be a valid string',
  got: '1',
}

describe('formatProblems for a generated config', () => {
  test('names the file and the keyed path instead of framing generated JSON', () => {
    const output = stripAnsi(formatProblems(generated, [warning, locked]))
    expect(output).toBe(
      [
        '  Warning: No events named "tool_call" have been received yet',
        '    at polar.config.ts › meters.tool_calls.filter.clauses.0.value',
        '  help: The meter counts events with this name, so it stays at zero until your app sends one. Fine for a new event; if the name looks wrong, compare it with polar events list_names.',
        '',
        '  Error: Cannot change "filter" of meters.tool_calls',
        '    at polar.config.ts › meters.tool_calls.filter',
      ].join('\n'),
    )
  })

  test('shows the offending value when there is no frame to point at', () => {
    const output = stripAnsi(formatProblems(generated, [invalid]))
    expect(output).toContain(
      'Invalid value for "name" at meters.tool_calls.name',
    )
    expect(output).toContain('at polar.config.ts › meters.tool_calls.name')
    expect(output).toContain('help: Got 1.')
  })
})
