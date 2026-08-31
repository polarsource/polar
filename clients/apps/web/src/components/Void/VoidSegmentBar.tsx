'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { SegmentTone } from './identityInsights'

export interface SegmentDatum {
  label: string
  share: number
  tone: SegmentTone
  detail?: string
}

const TONES: Record<
  SegmentTone,
  {
    backgroundColor: 'background-inverse' | 'background-danger'
    opacity: number
  }
> = {
  ink: { backgroundColor: 'background-inverse', opacity: 1 },
  mid: { backgroundColor: 'background-inverse', opacity: 0.45 },
  faint: { backgroundColor: 'background-inverse', opacity: 0.15 },
  danger: { backgroundColor: 'background-danger', opacity: 1 },
}

export const VoidSegmentBar = ({
  segments,
  height = 64,
}: {
  segments: SegmentDatum[]
  height?: number
}) => {
  const visible = segments.filter((segment) => segment.share > 0)

  return (
    <Box flexDirection="column" rowGap="xl">
      <Box height={height} columnGap="xs">
        {visible.map((segment) => (
          <Box
            key={segment.label}
            width={`${segment.share * 100}%`}
            height="100%"
            backgroundColor={TONES[segment.tone].backgroundColor}
            opacity={TONES[segment.tone].opacity}
          />
        ))}
      </Box>
      <Box columnGap="3xl" rowGap="l" flexWrap="wrap">
        {segments.map((segment) => (
          <Box key={segment.label} flexDirection="column" rowGap="xs">
            <Text variant="heading-xxs">{segment.label}</Text>
            <Text variant="heading-xxs" color="muted">
              {`${Math.round(segment.share * 100)}%${segment.detail ? ` / ${segment.detail}` : ''}`}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
