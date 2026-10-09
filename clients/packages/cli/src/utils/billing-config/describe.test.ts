import { describe, expect, test } from 'vitest'
import { describeValue, priceGroups } from '@/utils/billing-config/describe'

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

describe('describeValue for products and benefits', () => {
  test('groups prices by kind with amounts per currency', () => {
    const groups = priceGroups([
      {
        amount_type: 'fixed',
        price_currency: 'usd',
        tax_behavior: null,
        price_amount: 9999,
      },
      { amount_type: 'fixed', price_currency: 'jpy', price_amount: 14999 },
      {
        amount_type: 'metered_unit',
        price_currency: 'eur',
        meter: 'tool_call',
        unit_amount: '0.09',
        cap_amount: 9000,
      },
      {
        amount_type: 'metered_unit',
        price_currency: 'jpy',
        meter: 'tool_call',
        unit_amount: '1.5',
        cap_amount: 15000,
      },
      {
        amount_type: 'metered_unit',
        price_currency: 'usd',
        meter: 'image_generation',
        unit_amount: '12.5',
        cap_amount: null,
      },
    ])
    expect(groups?.map(({ label, text }) => [label, text.text])).toEqual([
      ['USD', '$99.99'],
      ['JPY', '¥14,999'],
      ['EUR per tool_call', '€0.90 per 1,000\ncapped at €90'],
      ['JPY per tool_call', '¥1.5\ncapped at ¥15,000'],
      ['USD per image_generation', '$0.125'],
    ])
    expect(
      priceGroups([
        {
          amount_type: 'metered_unit',
          price_currency: 'usd',
          meter: 'token',
          unit_amount: '0.000000000001',
        },
        {
          amount_type: 'metered_unit',
          price_currency: 'usd',
          meter: 'token',
          unit_amount: 1e-12,
        },
        {
          amount_type: 'metered_unit',
          price_currency: 'usd',
          meter: 'token',
          unit_amount: '0.000000000002',
        },
      ])?.map(({ text }) => text.text),
    ).toEqual(['$0.00000000000001\n$0.00000000000001\n$0.00000000000002'])
    expect(
      priceGroups([
        { amount_type: 'fixed', price_currency: 'usd', price_amount: 999 },
        { amount_type: 'fixed', price_currency: 'usd', price_amount: 9999 },
      ])?.map(({ label, text }) => [label, text.text]),
    ).toEqual([['USD', '$9.99\n$99.99']])
    expect(priceGroups([{ amount_type: 'seat_based' }])).toBeUndefined()
    expect(priceGroups([])).toBeUndefined()
  })

  test('describes a price list inline when it is not expanded into rows', () => {
    expect(
      describeValue([
        { amount_type: 'fixed', price_currency: 'usd', price_amount: 0 },
        {
          amount_type: 'metered_unit',
          price_currency: 'usd',
          meter: 'tool_call',
          unit_amount: '10',
          cap_amount: 500,
        },
      ]),
    ).toBe('USD: $0\nUSD per tool_call: $0.10, capped at $5')
  })

  test('describes meter credit properties', () => {
    expect(
      describeValue({ meter: 'tool_call', units: 1000, rollover: false }),
    ).toBe('1,000 tool_call credits')
    expect(
      describeValue({ meter: 'tool_call', units: 50, rollover: true }),
    ).toBe('50 tool_call credits, unused credits roll over')
  })

  test('joins lists of references and names empty lists', () => {
    expect(describeValue(['custom_servers', 'tool_calls'])).toBe(
      'custom_servers, tool_calls',
    )
    expect(describeValue([])).toBe('none')
  })

  test('leaves unknown shapes to the caller', () => {
    expect(describeValue({ foo: 'bar' })).toBeUndefined()
    expect(describeValue([{ foo: 'bar' }])).toBeUndefined()
    expect(describeValue({ amount_type: 'seat_based' })).toBeUndefined()
  })
})
