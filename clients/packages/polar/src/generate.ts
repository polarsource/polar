import { Effect } from 'effect'
import { validateConfig } from './schema/config'
import type { MeterConfig } from './schema/meter'

const literal = (value: string | number | boolean): string =>
  Object.is(value, -0) ? '-0' : JSON.stringify(value)

const key = (value: string): string =>
  value === '__proto__' ? `[${literal(value)}]` : literal(value)

const renderMeter = (meter: MeterConfig, imports: Set<string>): string => {
  const [first, ...remaining] = meter.filter.clauses
  const event =
    meter.filter.conjunction === 'and' &&
    first?.property === 'name' &&
    first.operator === 'eq' &&
    typeof first.value === 'string'
      ? first.value
      : undefined
  const lines = [
    `fold(${literal(meter.name)}${event === undefined ? '' : `, ${literal(event)}`})`,
  ]

  if (meter.filter.conjunction === 'or') {
    lines.push(
      [
        '.filter({',
        '  conjunction: "or",',
        '  clauses: [',
        ...meter.filter.clauses.map(
          (clause) =>
            `    { property: ${literal(clause.property)}, operator: ${literal(clause.operator)}, value: ${literal(clause.value)} },`,
        ),
        '  ],',
        '})',
      ].join('\n'),
    )
  } else {
    const clauses = event === undefined ? meter.filter.clauses : remaining
    for (const clause of clauses) {
      const helper =
        clause.operator === 'not_like' ? 'notLike' : clause.operator
      imports.add(helper)
      lines.push(
        `.where({ ${key(clause.property)}: ${helper}(${literal(clause.value)}) })`,
      )
    }
  }

  if (meter.unit === 'custom') {
    lines.push(`.unit("custom", ${literal(meter.custom_label)})`)
  } else if (meter.unit === 'token') {
    lines.push('.unit("token")')
  }

  const aggregation = meter.aggregation
  lines.push(
    aggregation.func === 'count'
      ? '.count()'
      : `.${aggregation.func}(${literal(aggregation.property)})`,
  )
  return lines.join('\n')
}

export const generateConfig = Effect.fnUntraced(function* (input: unknown) {
  const config = yield* validateConfig(input)
  const imports = new Set(['defineConfig'])
  const ids = config.meters.map((meter) => meter.external_id)
  const objectKeys = Object.keys(
    Object.fromEntries(ids.map((id) => [id, null])),
  )
  const useEntries =
    objectKeys.length !== ids.length ||
    objectKeys.some((id, index) => id !== ids[index])
  const meters = config.meters.map((meter) => {
    const expression = renderMeter(meter, imports).replaceAll('\n', '\n      ')
    return useEntries
      ? `    [${literal(meter.external_id)}, ${expression}],`
      : `    ${key(meter.external_id)}: ${expression},`
  })

  return [
    `import { ${[...imports].join(', ')} } from '@polar-sh/polar'`,
    '',
    'export default defineConfig({',
    `  meters: ${meters.length === 0 ? '()' : '({ fold })'} => (${useEntries ? '[' : '{'}`,
    ...meters,
    `  ${useEntries ? ']' : '}'}),`,
    '})',
    '',
  ].join('\n')
})
