import { eventLLM, formatTokens } from '@/components/Events/EventLogRow'
import { useEvents } from '@/hooks/queries/events'
import { formatCostAmount } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const eventCostCents = (event: schemas['Event']) => {
  const cost = (event.metadata as { _cost?: { amount?: string | number } })
    ._cost
  return cost?.amount !== undefined ? Number(cost.amount) : null
}

const offset = (from: string, to: string) => {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return ms < 1000 ? `+${ms}ms` : `+${(ms / 1000).toFixed(1)}s`
}

// The steps below one use of the feature, each with its share of the cost.
export const FeatureEventSteps = ({
  organizationId,
  event,
  total,
}: {
  organizationId: string
  event: schemas['Event']
  total: number | null
}) => {
  const { data, isLoading } = useEvents(organizationId, {
    parent_id: event.id,
    depth: 1,
    limit: 100,
    sorting: ['timestamp'],
  })
  const steps = (data?.items ?? []).filter((step) => step.id !== event.id)

  if (isLoading) {
    return (
      <Box paddingVertical="s" paddingLeft="3xl">
        <Text color="muted">Loading steps</Text>
      </Box>
    )
  }
  if (steps.length === 0) {
    return (
      <Box paddingVertical="s" paddingLeft="3xl">
        <Text color="muted">No steps</Text>
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      paddingBottom="s"
    >
      {steps.map((step) => {
        const cost = eventCostCents(step)
        const llm = eventLLM(step)
        const share = cost !== null && total ? cost / total : null
        return (
          <Box
            key={step.id}
            gap="m"
            alignItems="center"
            minHeight={32}
            paddingLeft="3xl"
            paddingRight="s"
          >
            <Box width={64} flexShrink={0}>
              <Text variant="caption" color="muted" tabularNums>
                {offset(event.timestamp, step.timestamp)}
              </Text>
            </Box>
            <Box
              flexGrow={1}
              flexBasis={0}
              minWidth={0}
              gap="s"
              alignItems="baseline"
            >
              <Text truncate>{step.label}</Text>
              {llm && (
                <Text variant="caption" color="muted" truncate>
                  {[
                    llm.model,
                    llm.total_tokens !== undefined
                      ? `${formatTokens(Number(llm.total_tokens))} tokens`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </Box>
            <Box width={120} flexShrink={0} alignItems="center" gap="s">
              <Box
                flexGrow={1}
                height={3}
                backgroundColor="background-card"
                overflow="hidden"
              >
                <Box
                  height="100%"
                  width={`${share !== null ? Math.max(share * 100, 1) : 0}%`}
                  backgroundColor="background-inverse"
                  opacity={0.7}
                />
              </Box>
              <Box width={32} justifyContent="end">
                <Text variant="caption" color="muted" tabularNums>
                  {share !== null ? `${Math.round(share * 100)}%` : ''}
                </Text>
              </Box>
            </Box>
            <Box width={88} flexShrink={0} justifyContent="end">
              <Text color="muted" tabularNums>
                {cost !== null ? formatCostAmount(cost) : ''}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
