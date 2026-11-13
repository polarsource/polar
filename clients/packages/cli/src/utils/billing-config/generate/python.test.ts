import { describe, expect, test } from 'vitest'
import { python } from '@/utils/billing-config/generate/python'

const NONE = { events: [], meters: [], benefits: [], products: [] }

const attributes = (source: string) =>
  [...source.matchAll(/^ {4}(\w+): typing\.Final = (".*")$/gm)].map(
    ([, attribute, id]) => [attribute, JSON.parse(id!) as string],
  )

describe('python', () => {
  test('writes a class of names and a type for each section', () => {
    expect(
      python.render({
        events: ['tool_call', 'search'],
        meters: ['tool-calls', 'searches'],
        benefits: ['pro', 'class', 'tool_calls', 'tool-calls', '9lives'],
        products: [],
      }),
    ).toBe(`import typing


class Events:
    tool_call: typing.Final = "tool_call"
    search: typing.Final = "search"


EventName = typing.Literal["tool_call", "search"]


class Meters:
    tool_calls: typing.Final = "tool-calls"
    searches: typing.Final = "searches"


MeterId = typing.Literal["tool-calls", "searches"]


class Benefits:
    pro: typing.Final = "pro"
    id_class: typing.Final = "class"
    tool_calls: typing.Final = "tool_calls"
    tool_dash_calls: typing.Final = "tool-calls"
    id_9lives: typing.Final = "9lives"


BenefitId = typing.Literal["pro", "class", "tool_calls", "tool-calls", "9lives"]


class Products:
    pass


ProductId = typing.Never`)
  })

  test.each([
    [
      'an ID that is a valid name keeps it, whatever comes first',
      ['topup-100', 'topup_100'],
      [
        ['topup_dash_100', 'topup-100'],
        ['topup_100', 'topup_100'],
      ],
    ],
    [
      'IDs that would share a name spell out their punctuation',
      ['a.b', 'a-b', 'a:b'],
      [
        ['a_dot_b', 'a.b'],
        ['a_dash_b', 'a-b'],
        ['a_colon_b', 'a:b'],
      ],
    ],
    [
      'names Python or the file itself already use get a prefix',
      ['typing', 'mro', 'class', 'id_class'],
      [
        ['id_typing', 'typing'],
        ['id_mro', 'mro'],
        ['id_class_2', 'class'],
        ['id_class', 'id_class'],
      ],
    ],
  ])('%s', (_, ids, expected) => {
    const source = python.render({ ...NONE, benefits: ids })
    const reordered = python.render({ ...NONE, benefits: ids.toReversed() })

    expect(attributes(source)).toEqual(expected)
    expect(attributes(reordered)).toEqual(expected.toReversed())
  })

  test('puts each name on a line of its own when the type does not fit on one', () => {
    const source = python.render({
      ...NONE,
      products: [
        'starter_monthly',
        'starter_yearly',
        'team_monthly',
        'team_yearly',
        'enterprise',
      ],
    })

    expect(source).toContain(`ProductId = typing.Literal[
    "starter_monthly",
    "starter_yearly",
    "team_monthly",
    "team_yearly",
    "enterprise",
]`)
  })
})
