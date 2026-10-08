import { Effect } from 'effect'
import { validateConfig } from './schema/config'
import type { BenefitConfig } from './schema/benefit'
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
  const lines = [`meter(${literal(meter.name)})`]
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

const renderBenefit = (
  benefit: BenefitConfig,
  helpers: Set<string>,
): string => {
  const name = literal(benefit.description)
  if (benefit.type === 'feature_flag') {
    helpers.add('flag')
    return `flag(${name})`
  }
  helpers.add('credits')
  const { meter_external_id, units, rollover } = benefit.properties
  return [
    `credits(${name})`,
    `.meter(${literal(meter_external_id)})`,
    `.units(${literal(units)})`,
    ...(rollover ? ['.rollover()'] : []),
  ].join('\n')
}

const renderEntries = <Resource extends { readonly external_id: string }>(
  property: string,
  resources: ReadonlyArray<Resource>,
  render: (resource: Resource, helpers: Set<string>) => string,
): string[] => {
  const helpers = new Set<string>()
  const ids = resources.map((resource) => resource.external_id)
  const objectKeys = Object.keys(
    Object.fromEntries(ids.map((id) => [id, null])),
  )
  const useEntries =
    objectKeys.length !== ids.length ||
    objectKeys.some((id, index) => id !== ids[index])
  const lines = resources.map((resource) => {
    const expression = render(resource, helpers).replaceAll('\n', '\n      ')
    return useEntries
      ? `    [${literal(resource.external_id)}, ${expression}],`
      : `    ${key(resource.external_id)}: ${expression},`
  })
  const parameters =
    helpers.size === 0 ? '()' : `({ ${[...helpers].join(', ')} })`
  return [
    `  ${property}: ${parameters} => (${useEntries ? '[' : '{'}`,
    ...lines,
    `  ${useEntries ? ']' : '}'}),`,
  ]
}

export const generateConfig = Effect.fnUntraced(function* (input: unknown) {
  const config = yield* validateConfig(input)
  const imports = new Set(['defineConfig'])
  const meters = renderEntries('meters', config.meters, (meter, helpers) => {
    helpers.add('meter')
    return renderMeter(meter, imports)
  })
  const benefits =
    config.benefits === undefined
      ? []
      : renderEntries('benefits', config.benefits, renderBenefit)

  return [
    `import { ${[...imports].join(', ')} } from '@polar-sh/polar'`,
    '',
    'export default defineConfig({',
    ...meters,
    ...benefits,
    '})',
    '',
  ].join('\n')
})
