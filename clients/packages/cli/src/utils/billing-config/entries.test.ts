import { describe, expect, test } from 'vitest'
import { formatEntries } from '@/utils/billing-config/entries'
import { stripAnsi } from '@/utils/test-utils/cli'

const ESC = String.fromCharCode(27)

describe('formatEntries', () => {
  test('groups entries under their section with a mark for what happened', () => {
    const output = stripAnsi(
      formatEntries([
        { section: 'meters', id: 'tool-calls', action: 'created', diff: [] },
        { section: 'meters', id: 'tokens', action: 'updated', diff: [] },
        {
          section: 'organization',
          id: 'organization',
          action: 'unchanged',
          diff: [],
        },
      ]),
    )
    expect(output).toBe(
      [
        '  meters',
        '    + tool-calls    created',
        '    ~ tokens        updated',
        '',
        '  organization',
        '    = organization  unchanged',
      ].join('\n'),
    )
  })

  test('lists each changed field under its entry', () => {
    const output = stripAnsi(
      formatEntries([
        {
          section: 'meters',
          id: 'tokens',
          action: 'updated',
          diff: [
            { field: 'name', before: 'Tokens', after: 'LLM tokens' },
            { field: 'custom_label', before: null, after: 'token' },
            {
              field: 'aggregation',
              before: { func: 'count' },
              after: { func: 'sum', property: 'n' },
            },
          ],
        },
        {
          section: 'meters',
          id: 'calls',
          action: 'created',
          diff: [
            { field: 'name', before: null, after: 'Calls' },
            {
              field: 'filter',
              before: null,
              after: {
                conjunction: 'and',
                clauses: [
                  { property: 'name', operator: 'eq', value: 'call' },
                  { property: 'status', operator: 'gte', value: 200 },
                ],
              },
            },
          ],
        },
        {
          section: 'meters',
          id: 'raw',
          action: 'updated',
          diff: [
            {
              field: 'metadata',
              before: { team: 'cli', owner: 'alice', region: 'eu-west-1' },
              after: { team: 'platform', owner: 'alice', region: 'eu-west-1' },
            },
          ],
        },
      ]),
    )
    expect(output).toBe(
      [
        '  meters',
        '    ~ tokens  updated',
        '        name          "Tokens" → "LLM tokens"',
        '        custom_label  unset → "token"',
        '        aggregation   count → sum(n)',
        '    + calls   created',
        '        name          "Calls"',
        '        filter        name = "call"',
        '                      AND status >= 200',
        '    ~ raw     updated',
        '        metadata',
        '          - {',
        '              "team": "cli",',
        '              "owner": "alice",',
        '              "region": "eu-west-1"',
        '            }',
        '          + {',
        '              "team": "platform",',
        '              "owner": "alice",',
        '              "region": "eu-west-1"',
        '            }',
      ].join('\n'),
    )
  })

  test('strips control characters from ids and field names', () => {
    const output = stripAnsi(
      formatEntries([
        {
          section: 'meters',
          id: `to${ESC}[31mol\ncalls`,
          action: 'created',
          diff: [{ field: 'na\u0007me', before: null, after: 'x' }],
        },
      ]),
    )
    expect(output).toContain('+ to[31mol calls  created')
    expect(output).toContain('name')
    expect(output).not.toContain('\u0007')
  })
})
