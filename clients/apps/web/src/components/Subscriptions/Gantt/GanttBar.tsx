import {
  type SubscriptionTimeline,
  type TimelineMarkerKind,
  type TimelineRange,
} from '@/utils/subscriptionTimeline'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  BAR_HEIGHT,
  BAR_RADIUS,
  formatGanttDate,
  ROW_HEIGHT,
  type GanttScale,
} from './scale'
import { TONE_OPACITY, type GanttTone } from './tone'

const SEGMENT_GAP = 2
const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2
export const HATCH =
  'repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 6px)'

const MARKER_LABELS: Record<TimelineMarkerKind, string> = {
  ended: 'Ended',
  ending: 'Ends',
  pausing: 'Pauses',
  paused: 'Paused',
  resuming: 'Resumes',
}

const HATCH_OPACITY = { trial: 0.7, paused: 0.45 } as const

interface GanttBarProps {
  timeline: SubscriptionTimeline
  scale: GanttScale
  rendered: TimelineRange
  tone: GanttTone
  now: number
}

export const GanttBar = ({
  timeline,
  scale,
  rendered,
  tone,
  now,
}: GanttBarProps) => {
  const { segments, marker } = timeline

  return (
    <>
      <Box
        position="absolute"
        top={0}
        bottom={0}
        left={scale.toX(timeline.start) - 8}
        transform="translateX(-100%)"
        alignItems="center"
        pointerEvents="none"
      >
        <Text variant="caption" color="muted" wrap="nowrap" tabularNums>
          {formatGanttDate(timeline.start, now)}
        </Text>
      </Box>
      {segments
        .filter(
          ({ start, end }) => end > rendered.start && start < rendered.end,
        )
        .map((segment) => {
          const left = scale.toX(segment.start)
          const hatchOpacity =
            segment.kind === 'trial' || segment.kind === 'paused'
              ? HATCH_OPACITY[segment.kind]
              : null
          return (
            <Box
              key={segment.start}
              position="absolute"
              top={BAR_TOP}
              left={left}
              width={Math.max(1, scale.toX(segment.end) - left - SEGMENT_GAP)}
              height={BAR_HEIGHT}
            >
              <div
                className="flex size-full overflow-hidden"
                style={{ borderRadius: BAR_RADIUS }}
              >
                {hatchOpacity !== null ? (
                  <Box
                    flexGrow={1}
                    color="text-tertiary"
                    opacity={hatchOpacity}
                  >
                    <div
                      className="size-full"
                      style={{ backgroundImage: HATCH }}
                    />
                  </Box>
                ) : (
                  <Box
                    flexGrow={1}
                    backgroundColor={tone}
                    opacity={
                      TONE_OPACITY[tone] *
                      (segment.kind === 'current' ? 1 : 0.5)
                    }
                  />
                )}
              </div>
            </Box>
          )
        })}
      {marker && (
        <Box
          position="absolute"
          top={0}
          bottom={0}
          left={scale.toX(marker.at) + 8}
          alignItems="center"
          pointerEvents="none"
        >
          <Text variant="caption" color="muted" wrap="nowrap" tabularNums>
            {marker.kind === 'paused'
              ? MARKER_LABELS.paused
              : `${MARKER_LABELS[marker.kind]} ${formatGanttDate(marker.at, now)}`}
          </Text>
        </Box>
      )}
    </>
  )
}
