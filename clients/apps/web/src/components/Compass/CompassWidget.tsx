'use client'

import { useCompassInsights } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { InsightCard } from './InsightCard'

interface CompassWidgetProps {
  organization: schemas['Organization']
  /** Cap the number of cards rendered. Defaults to the full list. The
   * dashboard home variant passes ``limit={3}`` so the row fills the
   * 3-column grid without wrapping. */
  limit?: number
  /** Hide the header row. The dedicated /compass page renders its own
   * page-level title via DashboardBody and doesn't want a second one. */
  hideHeader?: boolean
  /** Card arrangement. ``grid`` is the connected 3-column preview used on the
   * dashboard home; ``column`` stacks the cards vertically for the dedicated
   * /compass page. */
  layout?: 'grid' | 'column'
  /** Render nothing (not even a header or empty state) when there are no
   * insights. The dashboard home passes this so the section simply collapses
   * rather than showing an "all caught up" placeholder; the dedicated /compass
   * page keeps its empty state. */
  hideWhenEmpty?: boolean
}

/**
 * Compass insights widget, fed by the Compass API. The feed arrives ordered by
 * severity (most consequential first), so the home preview's top slice is
 * always what the merchant should care about most.
 *
 * Outer chrome mirrors PlanUpsell's connected 3-column grid: one rounded
 * border around the whole block, internal dividers between cells (left on lg,
 * top on base so the cells stack on mobile with clean separators).
 */
export const CompassWidget = ({
  organization,
  limit,
  hideHeader = false,
  layout = 'grid',
  hideWhenEmpty = false,
}: CompassWidgetProps) => {
  const { data: insights, isLoading } = useCompassInsights(organization.id)

  const shown =
    limit != null ? (insights ?? []).slice(0, limit) : (insights ?? [])

  // On the home overview the section shows up only once there's something to
  // say — no skeleton flash, no empty placeholder — so it never occupies space
  // with nothing in it.
  if (hideWhenEmpty && (isLoading || shown.length === 0)) {
    return null
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="l">
      {!hideHeader && (
        <Box
          display="flex"
          flexDirection={{ base: 'column', md: 'row' }}
          rowGap="s"
          columnGap="m"
          alignItems={{ md: 'baseline' }}
          justifyContent="between"
        >
          <Box display="flex" alignItems="center" columnGap="s">
            <Text variant="heading-xs" as="h2">
              Compass
            </Text>
          </Box>
          <Link href={`/dashboard/${organization.slug}/compass`}>
            <Text color="muted">View all</Text>
          </Link>
        </Box>
      )}

      {isLoading ? (
        <div className="animate-pulse">
          <Box
            height={160}
            borderRadius="l"
            backgroundColor="background-card"
          />
        </div>
      ) : shown.length > 0 ? (
        <Box
          display="grid"
          gridTemplateColumns={
            layout === 'column' ? '1fr' : { base: '1fr', lg: 'repeat(3, 1fr)' }
          }
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
                borderLeftWidth={
                  layout === 'column' ? 0 : { base: 0, lg: col === 0 ? 0 : 1 }
                }
                borderTopWidth={
                  layout === 'column'
                    ? idx === 0
                      ? 0
                      : 1
                    : { base: idx === 0 ? 0 : 1, lg: row === 0 ? 0 : 1 }
                }
              >
                <InsightCard organization={organization} insight={insight} />
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
            You’re all caught up. New insights surface as your metrics move.
          </Text>
        </Box>
      )}
    </Box>
  )
}
