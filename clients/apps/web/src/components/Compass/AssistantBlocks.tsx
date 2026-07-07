'use client'

import { ParsedMetricPeriod } from '@/hooks/queries'
import { AssistantBlock, AssistantPart } from '@/hooks/useCompassAssistant'
import { getFormattedMetricValue } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { Grid, GridItem, Text } from '@polar-sh/orbit'
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
      <MetricChart
        data={data}
        interval="day"
        metric={metric}
        height={140}
        simple
      />
    </Box>
  )
}

/**
 * Streamed text, split into digestible paragraphs. The model separates
 * thoughts with newlines; HTML would collapse them, so each chunk becomes its
 * own Text node with consistent spacing.
 */
const ParagraphsText = ({ text }: { text: string }) => {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0)
  return (
    <Box display="flex" flexDirection="column" rowGap="m">
      {paragraphs.map((paragraph, i) => (
        <Text key={i} variant="body">
          {paragraph}
        </Text>
      ))}
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
      return <ParagraphsText text={block.text} />
    case 'metric_chart':
      return <MetricChartView block={block} />
    case 'insight_cards':
      return (
        <Grid templateColumns="repeat(2, 1fr)" gap="m">
          {block.insights.map((insight) => (
            <GridItem key={insight.id}>
              <Box
                padding="l"
                borderRadius="l"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
                backgroundColor="background-card"
              >
                <InsightCard
                  organization={organization}
                  insight={insight}
                  size="small"
                />
              </Box>
            </GridItem>
          ))}
        </Grid>
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
    return <ParagraphsText text={part.text} />
  }
  return <AssistantBlockView block={part.block} organization={organization} />
}
