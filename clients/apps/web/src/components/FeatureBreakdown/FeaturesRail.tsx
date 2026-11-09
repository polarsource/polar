'use client'

import { useFeatureBreakdown } from '@/hooks/queries/featureBreakdown'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { economics, FeatureSummary, formatMargin } from './featureEconomics'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { useFeatureRange } from './useFeatureRange'
import { useRailState } from './useRailState'

const hasEconomics = (f: FeatureSummary) =>
  Number(f.cost) > 0 || Number(f.revenue) > 0

// Worst margin first, so what needs attention leads the list. Features with
// cost but no revenue have no margin rate and sort to the top.
const marginRate = (f: FeatureSummary) => economics(f).marginRate ?? -Infinity

const RailItem = ({
  href,
  active,
  danger = false,
  label,
  value,
}: {
  href: string
  active: boolean
  danger?: boolean
  label: string
  value: string
}) => (
  <Link href={href} aria-current={active ? 'page' : undefined}>
    <Box
      alignItems="center"
      gap="s"
      paddingHorizontal="m"
      paddingVertical="s"
      borderRadius="m"
      backgroundColor={{
        base: active ? 'background-card' : undefined,
        hover: 'background-card',
      }}
    >
      <Box flexGrow={1} minWidth={0} alignItems="center" gap="s">
        <Text color={active ? undefined : 'muted'} truncate>
          {label}
        </Text>
        {danger && (
          // No Orbit background token is a solid red, so match the charts'.
          <span
            aria-label="Loses money"
            className="size-[5px] shrink-0 rounded-full bg-red-500"
          />
        )}
      </Box>
      <Text color="muted" tabularNums>
        {value}
      </Text>
    </Box>
  </Link>
)

export const FeaturesRail = ({
  organization,
  selected,
}: {
  organization: schemas['Organization']
  selected: string | null
}) => {
  const range = useFeatureRange(organization)
  const [{ all }, setRail] = useRailState()
  const { data } = useFeatureBreakdown(organization.id, {
    ...range.rangePeriod,
    interval: range.interval,
  })
  const searchParams = useSearchParams()
  const query = new URLSearchParams(searchParams.toString())
  query.delete('segment')
  query.delete('selected')
  const suffix = query.size > 0 ? `?${query}` : ''
  const base = `/dashboard/${organization.slug}/analytics/features`

  const hidden = (data?.features ?? []).filter((f) => !hasEconomics(f)).length
  const features = (data?.features ?? [])
    .filter((f) => all || hasEconomics(f))
    .toSorted((a, b) => marginRate(a) - marginRate(b))

  return (
    <Box
      flexDirection="column"
      gap="xl"
      height="100%"
      overflowY="auto"
      padding="l"
    >
      <Box flexDirection="column" gap="s">
        <Text>Timeline</Text>
        <DateRangePicker
          date={range.dateRange}
          onDateChange={range.setDateRange}
          additionalIntervals={range.intervals}
          selectedInterval={range.selectedRange}
          className="w-full"
        />
      </Box>
      <Box flexDirection="column" gap="s">
        <Box justifyContent="between">
          <Text>Features</Text>
          <Text color="muted">Margin</Text>
        </Box>
        <Box flexDirection="column" gap="xs" marginHorizontal="-m">
          <RailItem
            href={`${base}${suffix}`}
            active={selected === null}
            label="All features"
            value={data ? formatMargin(economics(data)) : ''}
          />
          {features.map((f) => (
            <RailItem
              key={f.name}
              href={`${base}/${encodeURIComponent(f.name)}${suffix}`}
              active={selected === f.name}
              danger={economics(f).margin < 0}
              label={f.label}
              value={formatMargin(economics(f))}
            />
          ))}
          {hidden > 0 && (
            <button
              type="button"
              className="cursor-pointer self-start"
              onClick={() => setRail({ all: !all || null })}
            >
              <Box paddingHorizontal="m" paddingVertical="s">
                <Text color="muted">
                  {all ? 'Hide' : 'Show'} {hidden} without cost
                </Text>
              </Box>
            </button>
          )}
          {data && features.length === 0 && (
            <Box paddingHorizontal="m" paddingVertical="s">
              <Text color="muted">No features</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
