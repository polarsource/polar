import { Schema } from 'effect'
import {
  literal,
  type Node,
} from '@/services/billing-config/languages/python/render/syntax'

const OPERATORS = [
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'not_like',
] as const

export const FILTER_HELPERS = ['and_', 'or_', ...OPERATORS]

const Clause = Schema.Struct({
  property: Schema.String,
  operator: Schema.Literals(OPERATORS),
  value: Schema.Union([Schema.String, Schema.Int, Schema.Boolean]),
})
type Clause = typeof Clause.Type

export interface Group {
  readonly conjunction: 'and' | 'or'
  readonly clauses: ReadonlyArray<Clause | Group>
}

export const Group = Schema.Struct({
  conjunction: Schema.Literals(['and', 'or']),
  clauses: Schema.Array(
    Schema.Union([Clause, Schema.suspend((): Schema.Codec<Group> => Group)]),
  ),
})

export const condition = (
  input: Clause | Group,
  imports: Set<string>,
): Node => {
  if ('conjunction' in input) {
    const head = `${input.conjunction}_`
    imports.add(head)
    return {
      head,
      args: input.clauses.map((clause) => condition(clause, imports)),
    }
  }
  imports.add(input.operator)
  return `${input.operator}(${literal(input.property)}, ${literal(input.value)})`
}

const isGroup = (clause: Clause | Group | undefined): clause is Group =>
  clause !== undefined && 'conjunction' in clause

const isAnd = (clause: Clause | Group | undefined) =>
  isGroup(clause) && clause.conjunction === 'and'

const eventName = (clause: Clause | Group) =>
  !isGroup(clause) &&
  clause.property === 'name' &&
  clause.operator === 'eq' &&
  typeof clause.value === 'string'
    ? clause.value
    : undefined

const severalEventNames = (clause: Clause | Group) => {
  if (
    !isGroup(clause) ||
    clause.conjunction !== 'or' ||
    clause.clauses.length < 2
  ) {
    return undefined
  }
  const names = clause.clauses.map(eventName)
  return names.every((name) => name !== undefined) ? names : undefined
}

const eventNames = (clause: Clause | Group) => {
  const single = eventName(clause)
  return single === undefined ? severalEventNames(clause) : [single]
}

interface FilterArguments {
  readonly events: ReadonlyArray<string>
  readonly where: Clause | Group | undefined
}

const whereOnly = (filter: Group): FilterArguments => {
  const [clause] = filter.clauses
  const sdkAddsTheGroup =
    filter.conjunction === 'and' &&
    filter.clauses.length <= 1 &&
    !isGroup(clause)
  return { events: [], where: sdkAddsTheGroup ? clause : filter }
}

export const eventsAndWhere = (filter: Group): FilterArguments => {
  const onlyEvents = severalEventNames(filter)
  if (onlyEvents !== undefined) return { events: onlyEvents, where: undefined }

  const [first, ...conditions] = filter.clauses
  const events =
    filter.conjunction === 'and' && first !== undefined
      ? eventNames(first)
      : undefined
  if (events === undefined) return whereOnly(filter)

  const [condition] = conditions
  const sdkWouldFlattenCondition = conditions.length === 1 && isAnd(condition)
  const sdkWouldDropOuterGroup = events.length > 1 && conditions.length === 0
  if (sdkWouldFlattenCondition || sdkWouldDropOuterGroup) {
    return whereOnly(filter)
  }

  return {
    events,
    where:
      conditions.length > 1
        ? { conjunction: 'and', clauses: conditions }
        : condition,
  }
}
