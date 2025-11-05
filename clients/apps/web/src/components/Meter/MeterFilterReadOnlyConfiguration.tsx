'use client'

import { schemas } from '@polar-sh/client'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'

const OPERATOR_DISPLAY_NAMES: Record<schemas['FilterOperator'], string> = {
  eq: 'equals',
  ne: 'does not equal',
  gt: 'is greater than',
  gte: 'is greater than or equal to',
  lt: 'is less than',
  lte: 'is less than or equal to',
  like: 'contains',
  not_like: 'does not contain',
}

const AGGREGATION_DISPLAY_NAMES: Record<string, string> = {
  count: 'Count',
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
  unique: 'Unique',
}

const isFilterClause = (
  filter: schemas['Filter'] | schemas['FilterClause'],
): filter is schemas['FilterClause'] => {
  return 'property' in filter
}

const formatProperty = (property: string): string => {
  if (property === 'name') return 'Name'
  if (property === 'timestamp') return 'Timestamp'
  if (property.startsWith('metadata.')) {
    return property.slice('metadata.'.length)
  }
  return property
}

const formatValue = (value: string | number | boolean): string => {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  return value
}

interface FilterClauseDisplayProps {
  clause: schemas['FilterClause']
  showConjunction?: boolean
  conjunction?: string
}

const FilterClauseDisplay = ({
  clause,
  showConjunction,
  conjunction,
}: FilterClauseDisplayProps) => {
  return (
    <div className="flex w-full flex-row items-baseline gap-x-2">
      {showConjunction && (
        <div className="text-muted-foreground h-8 w-8 flex-none text-sm">
          {conjunction}
        </div>
      )}
      <div className="flex grow items-baseline gap-2 text-sm">
        <span
          className={
            clause.property === 'name' || clause.property === 'timestamp'
              ? ''
              : 'font-mono text-xs'
          }
        >
          {formatProperty(clause.property)}
        </span>
        <span className="text-muted-foreground">
          {OPERATOR_DISPLAY_NAMES[clause.operator]}
        </span>
        <span className="font-mono text-xs">{formatValue(clause.value)}</span>
      </div>
    </div>
  )
}

interface FilterGroupDisplayProps {
  filter: schemas['Filter']
  showConjunction?: boolean
  conjunction?: string
}

const FilterGroupDisplay = ({
  filter,
  showConjunction,
  conjunction,
}: FilterGroupDisplayProps) => {
  return (
    <div className="flex flex-col gap-4">
      {showConjunction && (
        <div className="text-muted-foreground w-12 pl-4 text-center text-sm">
          {conjunction}
        </div>
      )}
      <ShadowBox className="flex flex-col gap-3 rounded-2xl! p-4">
        {filter.clauses.map((clause, index) => {
          if (isFilterClause(clause)) {
            return (
              <FilterClauseDisplay
                key={index}
                clause={clause}
                showConjunction={index > 0}
                conjunction={filter.conjunction}
              />
            )
          } else {
            return (
              <FilterGroupDisplay
                key={index}
                filter={clause}
                showConjunction={index > 0}
                conjunction={filter.conjunction}
              />
            )
          }
        })}
      </ShadowBox>
    </div>
  )
}

interface MeterFilterReadOnlyConfigurationProps {
  filter?: schemas['Filter']
  aggregation:
    | schemas['CountAggregation']
    | schemas['PropertyAggregation']
    | schemas['UniqueAggregation']
}

const MeterFilterReadOnlyConfiguration = ({
  filter,
  aggregation,
}: MeterFilterReadOnlyConfigurationProps) => {
  const aggregationFunc = aggregation.func
  const aggregationProperty =
    'property' in aggregation ? aggregation.property : null

  return (
    <div className="flex flex-col gap-6">
      {filter && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Filters</h3>
          <div className="flex flex-col gap-3">
            {filter.clauses.map((clause, index) => {
              if (isFilterClause(clause)) {
                return (
                  <ShadowBox
                    className="flex flex-col gap-3 rounded-2xl! p-4"
                    key={index}
                  >
                    <FilterClauseDisplay
                      clause={clause}
                      showConjunction={index > 0}
                      conjunction={filter.conjunction}
                    />
                  </ShadowBox>
                )
              } else {
                return (
                  <FilterGroupDisplay
                    key={index}
                    filter={clause}
                    showConjunction={index > 0}
                    conjunction={filter.conjunction}
                  />
                )
              }
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Aggregation</h3>
        <div className="flex items-baseline gap-2 text-sm">
          <span className="">{AGGREGATION_DISPLAY_NAMES[aggregationFunc]}</span>
          {aggregationProperty && (
            <>
              <span className="text-muted-foreground">over</span>
              <span className="font-mono text-xs">{aggregationProperty}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeterFilterReadOnlyConfiguration
