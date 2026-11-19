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
import { GanttFill } from './GanttFill'
import { TONE_COLOR, type GanttTone } from './tone'

const SEGMENT_GAP = 2
const DIVIDER_WIDTH = 2
const DIVIDER_INSET = 5
// Drawn in the bar's own color, on top of it, so it reads as a deeper shade.
const DIVIDER_OPACITY: Record<GanttTone, number> = {
  neutral: 0.12,
  success: 0.3,
  warning: 0.3,
  danger: 0.3,
}
const LABEL_GAP = 14
const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2
const MARKER_LABELS: Record<TimelineMarkerKind, string> = {
  ended: 'Ended',
  ending: 'Ends',
  pausing: 'Pauses',
  paused: 'Paused',
  resuming: 'Resumes',
}

const STANDALONE_KINDS = new Set<string>(['trial', 'paused', 'current'])

// Cycles of the same kind run together with a divider. Anything else gets a gap.
const isSeparated = (a: { kind: string }, b: { kind: string }) =>
  STANDALONE_KINDS.has(a.kind) || STANDALONE_KINDS.has(b.kind)

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
  const first = segments[0]
  const last = segments.at(-1)
  const visible = segments.filter(
    ({ start, end }) => end > rendered.start && start < rendered.end,
  )

  return (
    <>
      <Box
        position="absolute"
        top={0}
        bottom={0}
        left={scale.x(timeline.start, -LABEL_GAP)}
        transform="translateX(-100%)"
        alignItems="center"
        pointerEvents="none"
        color="text-tertiary"
      >
        <Text variant="caption" color="inherit" wrap="nowrap" tabularNums>
          {formatGanttDate(timeline.start, now)}
        </Text>
      </Box>
      {first && last && (
        <Box
          position="absolute"
          top={BAR_TOP}
          left={scale.x(first.start)}
          width={scale.span(first.start, last.end)}
          height={BAR_HEIGHT}
        >
          <div
            className="flex size-full overflow-hidden"
            style={{ borderRadius: BAR_RADIUS }}
          >
            {visible[0] && visible[0] !== first && (
              <Box
                flexShrink={0}
                width={scale.span(first.start, visible[0].start)}
              />
            )}
            {visible.map((segment) => {
              const index = segments.indexOf(segment)
              const previous = segments[index - 1]
              const next = segments[index + 1]
              const gapLeft =
                previous !== undefined && isSeparated(previous, segment)
              const gapRight = next !== undefined && isSeparated(segment, next)
              const hasDivider = previous !== undefined && !gapLeft
              return (
                <Box
                  key={segment.start}
                  position="relative"
                  flexShrink={0}
                  width={scale.span(segment.start, segment.end)}
                >
                  <div
                    className="flex grow overflow-hidden"
                    style={{
                      marginLeft: gapLeft ? SEGMENT_GAP : 0,
                      borderTopLeftRadius: gapLeft ? BAR_RADIUS : 0,
                      borderBottomLeftRadius: gapLeft ? BAR_RADIUS : 0,
                      borderTopRightRadius: gapRight ? BAR_RADIUS : 0,
                      borderBottomRightRadius: gapRight ? BAR_RADIUS : 0,
                    }}
                  >
                    <GanttFill
                      tone={tone}
                      pattern={
                        segment.kind === 'trial' || segment.kind === 'paused'
                          ? segment.kind
                          : undefined
                      }
                      strength={segment.kind === 'current' ? 1 : 0.5}
                    />
                  </div>
                  {hasDivider && (
                    <Box
                      position="absolute"
                      top={DIVIDER_INSET}
                      bottom={DIVIDER_INSET}
                      left={-DIVIDER_WIDTH / 2}
                      width={DIVIDER_WIDTH}
                      color={TONE_COLOR[tone]}
                      opacity={DIVIDER_OPACITY[tone]}
                    >
                      <div className="size-full rounded-full bg-current" />
                    </Box>
                  )}
                </Box>
              )
            })}
          </div>
        </Box>
      )}
      {marker && (
        <Box
          position="absolute"
          top={0}
          bottom={0}
          left={scale.x(marker.at, LABEL_GAP)}
          alignItems="center"
          pointerEvents="none"
          color="text-tertiary"
        >
          <Text variant="caption" color="inherit" wrap="nowrap" tabularNums>
            {marker.kind === 'paused'
              ? MARKER_LABELS.paused
              : `${MARKER_LABELS[marker.kind]} ${formatGanttDate(marker.at, now)}`}
          </Text>
        </Box>
      )}
    </>
  )
}
