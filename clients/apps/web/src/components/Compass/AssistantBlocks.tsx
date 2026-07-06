'use client'

import { ParsedMetricPeriod } from '@/hooks/queries'
import { AssistantBlock, AssistantPart } from '@/hooks/useCompassAssistant'
import { getFormattedMetricValue } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import MetricChart from '../Metrics/MetricChart'
import {
  CustomerCardView,
  EntityListView,
  EntityTableView,
} from './AssistantEntities'
import { InsightCard } from './InsightCard'

const MetricChartView = ({
  block,
}: {
  block: Extract<AssistantBlock, { type: 'metric_chart' }>
}) => {
  // Adapt the block's series to the dashboard's MetricChart, so assistant
  // charts are the same component (and look) as the analytics pages.
  const metric = useMemo(
    () =>
      ({
        slug: block.metric,
        display_name: block.label,
        type: block.unit,
      }) as schemas['Metric'],
    [block],
  )
  const data = useMemo(
    () =>
      block.points.map(
        (point) =>
          ({
            timestamp: new Date(point.timestamp),
            [block.metric]: point.value,
          }) as unknown as ParsedMetricPeriod,
      ),
    [block],
  )
  const latest = block.points[block.points.length - 1]?.value ?? 0

  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="m"
      padding="l"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
    >
      <Box display="flex" justifyContent="between" alignItems="center">
        <Text color="muted">{block.label}</Text>
        <Text monospace>{getFormattedMetricValue(metric, latest)}</Text>
      </Box>
      <MetricChart data={data} interval="day" metric={metric} height={140} simple />
    </Box>
  )
}

/**
 * The generative-UI registry: maps each assistant block type to a predefined,
 * reviewed component. The model can only pick block types from the closed
 * union — unknown types render nothing.
 */
export const AssistantBlockView = ({
  block,
  organization,
}: {
  block: AssistantBlock
  organization: schemas['Organization']
}) => {
  switch (block.type) {
    case 'text':
      return <Text>{block.text}</Text>
    case 'metric_chart':
      return <MetricChartView block={block} />
    case 'insight_cards':
      return (
        <Box display="flex" flexDirection="column" rowGap="m">
          {block.insights.map((insight) => (
            <Box
              key={insight.id}
              padding="l"
              borderRadius="l"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              backgroundColor="background-card"
            >
              <InsightCard organization={organization} insight={insight} />
            </Box>
          ))}
        </Box>
      )
    case 'entity_list':
      return <EntityListView block={block} />
    case 'data_table':
      return <EntityTableView block={block} />
    case 'customer_card':
      return <CustomerCardView block={block} />
    default:
      return null
  }
}

export const AssistantPartView = ({
  part,
  organization,
}: {
  part: AssistantPart
  organization: schemas['Organization']
}) => {
  if (part.kind === 'text') {
    return <Text>{part.text}</Text>
  }
  return <AssistantBlockView block={part.block} organization={organization} />
}
