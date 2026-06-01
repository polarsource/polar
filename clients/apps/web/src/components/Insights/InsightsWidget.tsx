'use client'

import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { InsightCard } from './InsightCard'
import { getMockInsights } from './mockData'
import { useInsightDismissals } from './useInsightDismissals'

interface InsightsWidgetProps {
  organization: schemas['Organization']
  /** Cap the number of cards rendered. Defaults to the full list. The
   * dashboard home variant passes ``limit={3}`` so the row fills the
   * 3-column grid without wrapping. */
  limit?: number
  /** Hide the header row. The dedicated /insights page renders its own
   * page-level title via DashboardBody and doesn't want a second one. */
  hideHeader?: boolean
  /** Update cadence note shown next to the header. */
  cadenceLabel?: string
}

/**
 * AI-powered insights widget. Outer chrome mirrors PlanUpsell's connected
 * 3-column grid: one rounded border around the whole block, internal
 * dividers between cells (left on lg, top on base so the cells stack on
 * mobile with clean separators).
 */
export const InsightsWidget = ({
  organization,
  limit,
  hideHeader = false,
}: InsightsWidgetProps) => {
  const { dismiss, reset, isDismissed, dismissedCount } = useInsightDismissals(
    organization.id,
  )

  const all = useMemo(
    () => getMockInsights(organization.slug),
    [organization.slug],
  )
  const visible = useMemo(
    () => all.filter((i) => !isDismissed(i.id)),
    [all, isDismissed],
  )
  const shown = limit != null ? visible.slice(0, limit) : visible

  return (
    <Box display="flex" flexDirection="column" rowGap="l">
      {!hideHeader && (
        <Box
          display="flex"
          flexDirection={{ base: 'column', md: 'row' }}
          rowGap="s"
          columnGap="m"
          alignItems={{ md: 'baseline' }}
        >
          <Box display="flex" alignItems="center" columnGap="s">
            <Text variant="heading-xs" as="h2">
              Insights
            </Text>
          </Box>
        </Box>
      )}

      {shown.length > 0 ? (
        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }}
          alignItems="stretch"
          overflow="hidden"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          {shown.map((insight, idx) => {
            const col = idx % 3
            const row = Math.floor(idx / 3)
            return (
              <Box
                key={insight.id}
                padding="2xl"
                borderStyle="solid"
                borderColor="border-primary"
                borderLeftWidth={{ base: 0, lg: col === 0 ? 0 : 1 }}
                borderTopWidth={{
                  base: idx === 0 ? 0 : 1,
                  lg: row === 0 ? 0 : 1,
                }}
              >
                <InsightCard
                  insight={insight}
                  onDismiss={() => dismiss(insight.id, 'dismiss')}
                />
              </Box>
            )
          })}
        </Box>
      ) : (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          rowGap="m"
          paddingVertical="2xl"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          textAlign="center"
        >
          <Text color="muted">
            You’re all caught up. Check back next week for fresh insights.
          </Text>
          {dismissedCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="cursor-pointer bg-transparent p-0 text-sm text-blue-500 hover:underline"
            >
              Restore dismissed
            </button>
          )}
        </Box>
      )}
    </Box>
  )
}
