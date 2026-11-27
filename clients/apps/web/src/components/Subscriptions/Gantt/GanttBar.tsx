import {
  type SubscriptionTimeline,
  type TimelineMarkerKind,
  type TimelineRange,
  type TimelineSegment,
  type TimelineSegmentKind,
} from '@/utils/subscriptionTimeline'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  BAR_HEIGHT,
  BAR_RADIUS,
  BAR_TOP,
  formatGanttDate,
  type GanttScale,
} from './scale'
import { GanttFill } from './GanttFill'
import { TONE_COLOR, type GanttTone } from './tone'

const SEGMENT_GAP = 2
// A 1px border, then the same gap that separates the segments. The frame's
// radius is the bar's plus this, so the two corners stay concentric.
const FRAME_PADDING = 1 + SEGMENT_GAP
const DIVIDER_WIDTH = 2
const DIVIDER_INSET = 5
// Drawn in the bar's own color, on top of it, so it reads as a deeper shade.
const DIVIDER_OPACITY: Record<GanttTone, number> = {
  neutral: 0.12,
  warning: 0.3,
  danger: 0.3,
}
const FRAME_OPACITY: Record<GanttTone, number> = {
  neutral: 0.08,
  warning: 0.18,
  danger: 0.18,
}
const LABEL_GAP = 14
const MARKER_LABELS: Record<TimelineMarkerKind, string> = {
  ended: 'Ended',
  ending: 'Ends',
  pausing: 'Pauses',
  paused: 'Paused',
  resuming: 'Resumes',
}

const isBilled = (kind: TimelineSegmentKind) =>
  kind === 'past' || kind === 'current'

interface Run {
  kind: TimelineSegmentKind
  start: number
  end: number
  dividers: number[]
}

// Billing cycles are drawn as one stretch with a divider at each cycle point,
// which keeps the element count per row small. The billed cycles form one
// stretch and the upcoming ones another. A trial and a pause stand alone, and
// so does any cycle the caller wants told apart.
const toRuns = (
  segments: TimelineSegment[],
  isSplit: (kind: TimelineSegmentKind) => boolean,
): Run[] => {
  const isStandalone = (kind: TimelineSegmentKind) =>
    kind === 'trial' || kind === 'paused' || isSplit(kind)
  const runs: Run[] = []
  for (const segment of segments) {
    const run = runs.at(-1)
    if (
      run &&
      !isStandalone(run.kind) &&
      !isStandalone(segment.kind) &&
      isBilled(run.kind) === isBilled(segment.kind)
    ) {
      run.dividers.push(segment.start)
      run.end = segment.end
    } else {
      runs.push({ ...segment, dividers: [] })
    }
  }
  return runs
}

interface GanttBarProps {
  timeline: SubscriptionTimeline
  scale: GanttScale
  rendered: TimelineRange
  tone: GanttTone
  now: number
  isSelected?: boolean
}

export const GanttBar = ({
  timeline,
  scale,
  rendered,
  tone,
  now,
  isSelected = false,
}: GanttBarProps) => {
  const { segments, marker } = timeline
  const first = segments[0]
  const last = segments.at(-1)
  // Past due is about one payment, so only the cycle it was for is marked.
  const restTone = tone === 'danger' ? 'neutral' : tone
  const runs = toRuns(
    segments,
    (kind) =>
      (isSelected && isBilled(kind)) ||
      (tone === 'danger' && kind === 'current'),
  )
  const dividers = runs
    .flatMap((run) => run.dividers)
    .filter((time) => time > rendered.start && time < rendered.end)

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
          top={BAR_TOP - FRAME_PADDING}
          left={scale.x(first.start, -FRAME_PADDING)}
          width={scale.span(first.start, last.end, -FRAME_PADDING * 2)}
          height={BAR_HEIGHT + FRAME_PADDING * 2}
          color={TONE_COLOR[restTone]}
          opacity={FRAME_OPACITY[restTone]}
          pointerEvents="none"
        >
          <div
            className="size-full border border-current"
            style={{ borderRadius: BAR_RADIUS + FRAME_PADDING }}
          />
        </Box>
      )}
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
            {runs.map((run, index) => {
              const gapLeft = index > 0
              const gapRight = index < runs.length - 1
              return (
                <Box
                  key={run.start}
                  flexShrink={0}
                  width={scale.span(run.start, run.end)}
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
                      tone={run.kind === 'current' ? tone : restTone}
                      pattern={
                        run.kind === 'trial' || run.kind === 'paused'
                          ? run.kind
                          : undefined
                      }
                      strength={run.kind === 'upcoming' ? 0.5 : 1}
                    />
                  </div>
                </Box>
              )
            })}
          </div>
        </Box>
      )}
      {dividers.length > 0 && (
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          color={TONE_COLOR[restTone]}
          opacity={DIVIDER_OPACITY[restTone]}
        >
          {dividers.map((time) => (
            <div
              key={time}
              className="absolute rounded-full bg-current"
              style={{
                left: scale.x(time, -DIVIDER_WIDTH / 2),
                top: BAR_TOP + DIVIDER_INSET,
                width: DIVIDER_WIDTH,
                height: BAR_HEIGHT - DIVIDER_INSET * 2,
              }}
            />
          ))}
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
