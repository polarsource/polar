import { isClause, ReducerFilter, ReducerFilterClause } from './reducers'

export interface DefinitionParts {
  /** Event names the reducer listens to. Empty means every event. */
  on: string[]
  /** Everything in the filter that is not a plain event-name match. */
  where: ReducerFilter | null
}

const isNameMatch = (entry: ReducerFilterClause | ReducerFilter) =>
  isClause(entry) && entry.property === 'name' && entry.operator === 'eq'

/**
 * Splits the event-name matches out of a filter so the definition can read as
 * "on these events, where these conditions hold".
 */
export const splitFilter = (filter: ReducerFilter | null): DefinitionParts => {
  if (!filter) return { on: [], where: null }
  const names = filter.clauses.filter(isNameMatch) as ReducerFilterClause[]
  const rest = filter.clauses.filter((entry) => !isNameMatch(entry))
  const on =
    filter.conjunction === 'or' && rest.length > 0
      ? []
      : names.map((clause) => String(clause.value))
  const whereClauses = on.length > 0 ? rest : filter.clauses
  return {
    on,
    where:
      whereClauses.length > 0
        ? { conjunction: filter.conjunction, clauses: whereClauses }
        : null,
  }
}

export const clauseProperty = (property: string): string =>
  property.startsWith('metadata.')
    ? property.slice('metadata.'.length)
    : property

export const OPERATOR_GLYPH: Record<ReducerFilterClause['operator'], string> = {
  eq: '=',
  ne: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  like: '~',
  not_like: '!~',
}
