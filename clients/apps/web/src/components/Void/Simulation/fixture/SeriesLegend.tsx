'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Delta } from './Delta'
import { usd } from './format'
import { SERIES_LABEL, SeriesKey, useSeriesColors } from './ScenarioChart'

interface SeriesLegendProps {
  values: Partial<Record<SeriesKey, number>>
  /** Deltas are shown against this series. */
  against?: SeriesKey
}

export const SeriesLegend = ({
  values,
  against = 'baseline',
}: SeriesLegendProps) => {
  const colors = useSeriesColors()
  const reference = values[against] ?? 0
  const keys = (Object.keys(SERIES_LABEL) as SeriesKey[]).filter(
    (key) => values[key] !== undefined,
  )

  return (
    <Box columnGap="2xl" rowGap="l" flexWrap="wrap">
      {keys.map((key) => {
        const value = values[key] ?? 0
        const delta = value - reference
        const showDelta = key !== against
        return (
          <Box key={key} flexDirection="column" rowGap="xs">
            <Box alignItems="center" columnGap="s">
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  backgroundColor: colors[key],
                  display: 'inline-block',
                }}
              />
              <Text color="muted" variant="caption">
                {SERIES_LABEL[key]}
              </Text>
            </Box>
            <Box alignItems="baseline" columnGap="s">
              <Text variant="heading-xxs">{usd(value)}</Text>
              {showDelta ? (
                <Delta
                  delta={delta}
                  ratio={reference > 0 ? delta / reference : null}
                  variant="caption"
                />
              ) : null}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
