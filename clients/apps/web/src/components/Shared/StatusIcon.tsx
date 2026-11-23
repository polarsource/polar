import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useId } from 'react'

// A ring that fills up as something moves along: an outline for not started,
// a level rising from the bottom for under way, and a filled disc with a mark
// cut out of it once it has settled one way or another.
export type StatusIconShape =
  | 'dashed'
  | 'empty'
  | 'half'
  | 'most'
  | 'check'
  | 'cross'
  | 'minus'
  | 'returned'

export type StatusIconTone = 'neutral' | 'yellow' | 'green' | 'red' | 'purple'

export interface StatusIconProps {
  shape: StatusIconShape
  tone?: StatusIconTone
}

const TONE_CLASS: Record<StatusIconTone, string> = {
  neutral: 'dark:text-polar-400 text-gray-400',
  yellow: 'text-amber-500',
  green: 'text-emerald-500',
  red: 'text-red-500',
  purple: 'text-indigo-400',
}

// How much of the ring's inside is filled, from the bottom.
const LEVEL: Partial<Record<StatusIconShape, number>> = {
  half: 0.5,
  most: 0.75,
}

// Cut out of the filled disc, so whatever is behind the icon shows through.
const CUTOUT: Partial<Record<StatusIconShape, string>> = {
  check: 'M4.2 7.2 6.1 9 9.8 5.1',
  cross: 'M5 5l4 4M9 5 5 9',
  minus: 'M4.6 7h4.8',
  returned: 'M6.2 4.5 4.3 6.4 6.2 8.3M4.5 6.4H8.3A1.6 1.6 0 0 1 8.3 9.6H7.3',
}

const INSIDE_RADIUS = 3.6

export const StatusIcon = ({ shape, tone = 'neutral' }: StatusIconProps) => {
  const id = useId()
  const maskId = `${id}-mask`
  const clipId = `${id}-clip`
  const level = LEVEL[shape]
  const cutout = CUTOUT[shape]
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`size-3.5 shrink-0 ${TONE_CLASS[tone]}`}
    >
      {cutout ? (
        <>
          <mask id={maskId}>
            <rect width="14" height="14" fill="white" />
            <path
              d={cutout}
              stroke="black"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </mask>
          <circle
            cx="7"
            cy="7"
            r="6.5"
            fill="currentColor"
            mask={`url(#${maskId})`}
          />
        </>
      ) : (
        <>
          <circle
            cx="7"
            cy="7"
            r="5.75"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray={shape === 'dashed' ? '1.6 2' : undefined}
            strokeLinecap={shape === 'dashed' ? 'round' : undefined}
          />
          {level !== undefined && (
            <>
              <clipPath id={clipId}>
                <circle cx="7" cy="7" r={INSIDE_RADIUS} />
              </clipPath>
              <rect
                x="0"
                y={7 + INSIDE_RADIUS - 2 * INSIDE_RADIUS * level}
                width="14"
                height="14"
                fill="currentColor"
                clipPath={`url(#${clipId})`}
              />
            </>
          )}
        </>
      )}
    </svg>
  )
}

// A status as an icon and its name, in place of a colored pill.
export const StatusLabel = ({
  label,
  ...icon
}: StatusIconProps & { label: string }) => (
  <Box alignItems="center" gap="s" minWidth={0}>
    <StatusIcon {...icon} />
    <Text truncate>{label}</Text>
  </Box>
)
