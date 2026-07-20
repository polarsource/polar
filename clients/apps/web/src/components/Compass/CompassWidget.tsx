'use client'

import { useHasPermission } from '@/hooks/permissions'
import { useCompassInsights } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Alert, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { InsightCardGrid } from './InsightCardGrid'

const SEVERITY_SECTIONS: {
  severity: schemas['InsightSeverity']
  label: string
  dotClassName: string
}[] = [
  { severity: 'critical', label: 'Needs action', dotClassName: 'bg-red-500' },
  {
    severity: 'warning',
    label: 'Worth attention',
    dotClassName: 'bg-amber-500',
  },
  {
    severity: 'opportunity',
    label: 'Opportunities',
    dotClassName: 'bg-green-500',
  },
  { severity: 'info', label: 'Good to know', dotClassName: 'bg-gray-400' },
]

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
  /** `small` tightens cell padding and card typography for compact surfaces
   * (e.g. the assistant conversation's empty state). */
  size?: 'default' | 'small'
  /** Grid column count on large screens (grid layout only). */
  columns?: 2 | 3
  /** Split the feed into one titled section per severity (needs action,
   * worth attention, opportunities, good to know). The dedicated insights
   * page passes this; previews keep the flat severity-ordered list. */
  groupBySeverity?: boolean
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
  size = 'default',
  columns = 3,
  groupBySeverity = false,
}: CompassWidgetProps) => {
  const canReadAnalytics = useHasPermission(organization.id, 'analytics:read')
  const compassEnabled =
    !!organization.feature_settings?.compass_enabled && canReadAnalytics
  const {
    data: insights,
    isLoading,
    isError,
  } = useCompassInsights(organization.id, compassEnabled)

  const shown =
    limit != null ? (insights ?? []).slice(0, limit) : (insights ?? [])

  // Compass is gated by the `compass_enabled` feature flag and by
  // `analytics:read`; render nothing when either is missing so neither the
  // home preview nor the dedicated page leaks through.
  if (!compassEnabled) {
    return null
  }

  // A failed fetch must not masquerade as "all caught up" (or vanish on
  // surfaces that hide the empty state) — say that loading failed.
  if (isError) {
    return (
      <Alert
        variant="warning"
        title="Insights could not be loaded"
        description="Compass is temporarily unavailable. Refresh to try again."
      />
    )
  }

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
        groupBySeverity ? (
          <Box display="flex" flexDirection="column" rowGap="4xl">
            {SEVERITY_SECTIONS.map(({ severity, label, dotClassName }) => {
              const group = shown.filter(
                (insight) => insight.severity === severity,
              )
              if (group.length === 0) {
                return null
              }
              return (
                <Box
                  key={severity}
                  display="flex"
                  flexDirection="column"
                  rowGap="xl"
                >
                  <Box alignItems="center" columnGap="l">
                    <div className={`size-2 rounded-full ${dotClassName}`} />
                    <Text variant="heading-xxs" as="h3">
                      {label}
                    </Text>
                    <Text variant="heading-xxs" color="muted">
                      {group.length}
                    </Text>
                  </Box>
                  <InsightCardGrid
                    organization={organization}
                    insights={group}
                    layout={layout}
                    columns={columns}
                    size={size}
                  />
                </Box>
              )
            })}
          </Box>
        ) : (
          <InsightCardGrid
            organization={organization}
            insights={shown}
            layout={layout}
            columns={columns}
            size={size}
          />
        )
      ) : (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          rowGap="m"
          paddingVertical="2xl"
          paddingHorizontal={{ base: 'xl', sm: '2xl' }}
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
