import { describe, expect, test } from 'vitest'
import { describeValue } from '@/utils/billing-config/describe'

const ESC = String.fromCharCode(27)

const eq = (property: string, value: unknown) => ({
  property,
  operator: 'eq',
  value,
})

describe('describeValue', () => {
  test('renders a single clause without its conjunctions', () => {
    expect(
      describeValue({
        conjunction: 'and',
        clauses: [{ conjunction: 'or', clauses: [eq('name', 'tool_call')] }],
      }),
    ).toBe('name = "tool_call"')
  })

  test('puts each top-level clause on its own line and parenthesises nested groups', () => {
    expect(
      describeValue({
        conjunction: 'and',
        clauses: [
          eq('name', 'api.request'),
          { property: 'status', operator: 'gte', value: 200 },
          {
            conjunction: 'or',
            clauses: [eq('model', 'claude'), eq('model', 'gpt')],
          },
        ],
      }),
    ).toBe(
      [
        'name = "api.request"',
        'AND status >= 200',
        'AND (model = "claude" OR model = "gpt")',
      ].join('\n'),
    )
  })

  test('describes an empty filter and aggregations', () => {
    expect(describeValue({ conjunction: 'and', clauses: [] })).toBe(
      'all events',
    )
    expect(describeValue({ func: 'count' })).toBe('count')
    expect(describeValue({ func: 'sum', property: 'tokens' })).toBe(
      'sum(tokens)',
    )
  })

  test('strips control characters from identifiers', () => {
    expect(
      describeValue({
        conjunction: 'and',
        clauses: [
          { property: `na${ESC}[31mme\n`, operator: 'eq', value: `x${ESC}` },
        ],
      }),
    ).toBe('na[31mme = "x\\u001b"')
    expect(describeValue({ func: 'sum', property: 'to\u0007kens' })).toBe(
      'sum(tokens)',
    )
  })

  test('leaves other values alone', () => {
    expect(describeValue({ team: 'cli' })).toBeUndefined()
    expect(describeValue('text')).toBeUndefined()
  })
})
