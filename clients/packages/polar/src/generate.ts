import { Effect } from 'effect'
import { validateConfig } from './schema/config'
import type { MeterConfig, MeterFilter } from './schema/meter'

const literal = (value: string | number | boolean): string =>
  Object.is(value, -0) ? '-0' : JSON.stringify(value)

const key = (value: string): string =>
  value === '__proto__' ? `[${literal(value)}]` : literal(value)

const renderCondition = (
  condition: MeterFilter['clauses'][number],
  imports: Set<string>,
): string => {
  if ('conjunction' in condition) {
    imports.add(condition.conjunction)
    return `${condition.conjunction}(${condition.clauses.map((clause) => renderCondition(clause, imports)).join(', ')})`
  }
  const helper =
    condition.operator === 'not_like' ? 'notLike' : condition.operator
  imports.add(helper)
  return `${helper}(${literal(condition.property)}, ${literal(condition.value)})`
}

const renderMeter = (meter: MeterConfig, imports: Set<string>): string => {
  const lines = [`meter().displayName(${literal(meter.name)})`]
  const filter = meter.filter
  if (filter.conjunction === 'or' || filter.clauses.length > 0) {
    const [only] = filter.clauses
    const condition =
      filter.conjunction === 'and' &&
      filter.clauses.length === 1 &&
      only &&
      'property' in only
        ? only
        : filter
    lines.push(`.where(${renderCondition(condition, imports)})`)
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
    `  meters: ${meters.length === 0 ? '()' : '({ meter })'} => (${useEntries ? '[' : '{'}`,
    ...meters,
    `  ${useEntries ? ']' : '}'}),`,
    '})',
    '',
  ].join('\n')
})
