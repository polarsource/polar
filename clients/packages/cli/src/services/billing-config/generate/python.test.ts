import { describe, expect, test } from 'vitest'
import { sectionsOf } from '@/services/billing-config/generate/contract'
import type { Names } from '@/services/billing-config/generate/names'
import { python } from '@/services/billing-config/generate/python'

const NONE: Names = {
  events: [],
  anyEvent: false,
  meters: [],
  benefits: [],
  products: [],
}

const render = (names: Partial<Names>) =>
  python.render(sectionsOf({ ...NONE, ...names }, python.reserved))

describe('python', () => {
  test('writes a class of names and a type for each section', () => {
    expect(
      render({
        events: ['tool_call', 'search'],
        meters: ['tool-calls', 'searches'],
        benefits: ['pro', 'class', 'tool_calls', 'tool-calls', '9lives'],
      }),
    ).toBe(`import typing


class Events:
    """The names of the events the meters in the config count."""

    tool_call: typing.Literal["tool_call"] = "tool_call"
    search: typing.Literal["search"] = "search"


EventName = typing.Literal["tool_call", "search"]


class Meters:
    """The external IDs of the meters in the config."""

    tool_calls: typing.Literal["tool-calls"] = "tool-calls"
    searches: typing.Literal["searches"] = "searches"


ExternalMeterId = typing.Literal["tool-calls", "searches"]


class Benefits:
    """The external IDs of the benefits in the config."""

    pro: typing.Literal["pro"] = "pro"
    id_class: typing.Literal["class"] = "class"
    tool_calls: typing.Literal["tool_calls"] = "tool_calls"
    tool_calls_2: typing.Literal["tool-calls"] = "tool-calls"
    id_9lives: typing.Literal["9lives"] = "9lives"


ExternalBenefitId = typing.Literal["pro", "class", "tool_calls", "tool-calls", "9lives"]


class Products:
    """The external IDs of the products in the config."""


ExternalProductId = typing.Never`)
  })

  test('keeps names Python or the file itself already use out of the classes', () => {
    const source = render({ benefits: ['typing', 'mro', 'import'] })

    expect(source).toContain('id_typing: typing.Literal["typing"] = "typing"')
    expect(source).toContain('id_mro: typing.Literal["mro"] = "mro"')
    expect(source).toContain('id_import: typing.Literal["import"] = "import"')
  })

  test('takes any string as an event name when a meter counts any event', () => {
    const source = render({ events: ['search'], anyEvent: true })

    expect(source).toContain('search: typing.Literal["search"] = "search"')
    expect(source).toContain('\nEventName = str\n')
    expect(source).toContain('\nExternalMeterId = typing.Never\n')
  })

  test('puts each name on a line of its own when the type does not fit on one', () => {
    const source = render({
      products: [
        'starter_monthly',
        'starter_yearly',
        'team_monthly',
        'team_yearly',
        'enterprise',
      ],
    })

    expect(source).toContain(`ExternalProductId = typing.Literal[
    "starter_monthly",
    "starter_yearly",
    "team_monthly",
    "team_yearly",
    "enterprise",
]`)
  })
})
