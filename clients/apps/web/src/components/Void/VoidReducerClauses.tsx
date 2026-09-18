import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { isClause, ReducerFilter, ReducerFilterClause } from './reducers'

const OPERATOR_LABELS: Record<ReducerFilterClause['operator'], string> = {
  eq: 'equals',
  ne: 'does not equal',
  gt: 'is greater than',
  gte: 'is greater than or equal to',
  lt: 'is less than',
  lte: 'is less than or equal to',
  like: 'contains',
  not_like: 'does not contain',
}

function propertyLabel(property: string): string {
  if (property === 'name') return 'Name'
  if (property === 'timestamp') return 'Timestamp'
  if (property.startsWith('metadata.')) {
    return property.slice('metadata.'.length)
  }
  return property
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function Clause({
  clause,
  conjunction,
}: {
  clause: ReducerFilterClause
  conjunction?: string
}): ReactNode {
  const system = clause.property === 'name' || clause.property === 'timestamp'
  return (
    <Box alignItems="baseline" columnGap="s" flexWrap="wrap">
      {conjunction ? <Text color="muted">{conjunction}</Text> : null}
      <Text variant={system ? 'body' : 'caption'} monospace={!system}>
        {propertyLabel(clause.property)}
      </Text>
      <Text color="muted">{OPERATOR_LABELS[clause.operator]}</Text>
      <Text variant="caption" monospace>
        {formatValue(clause.value)}
      </Text>
    </Box>
  )
}

interface VoidReducerClausesProps {
  filter: ReducerFilter
}

export function VoidReducerClauses({
  filter,
}: VoidReducerClausesProps): ReactNode {
  return (
    <Box
      flexDirection="column"
      rowGap="m"
      padding="l"
      borderRadius="l"
      backgroundColor="background-secondary"
    >
      {filter.clauses.map((entry, index) => {
        const conjunction = index > 0 ? filter.conjunction : undefined
        if (isClause(entry)) {
          return <Clause key={index} clause={entry} conjunction={conjunction} />
        }
        return (
          <Box key={index} flexDirection="column" rowGap="m">
            {conjunction ? <Text color="muted">{conjunction}</Text> : null}
            <VoidReducerClauses filter={entry} />
          </Box>
        )
      })}
    </Box>
  )
}
