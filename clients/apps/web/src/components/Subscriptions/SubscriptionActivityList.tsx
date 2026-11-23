import {
  type SubscriptionActivityItem,
  type SubscriptionActivityKind,
} from '@/utils/subscriptionSummary'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  FlaskConical,
  Plus,
  RefreshCw,
} from '@polar-sh/orbit/icons'
import { format } from 'date-fns'

const ACTIVITY_ICONS: Record<SubscriptionActivityKind, typeof Clock> = {
  started: Plus,
  trial: FlaskConical,
  converted: CircleCheck,
  renewal: RefreshCw,
  failed: CircleAlert,
  recovered: CircleCheck,
  canceled: CircleX,
  paused: CircleDashed,
  ended: CircleX,
  scheduled: Clock,
}

const NEGATIVE_KINDS = new Set<SubscriptionActivityKind>([
  'failed',
  'canceled',
  'ended',
])
const ICON_CLASS = 'dark:text-polar-500 h-3.5 w-3.5 text-gray-400'
const ICON_NEGATIVE_CLASS = 'h-3.5 w-3.5 text-red-500'
const ICON_POSITIVE_CLASS = 'h-3.5 w-3.5 text-emerald-500'

const getIconClass = (kind: SubscriptionActivityKind): string => {
  if (NEGATIVE_KINDS.has(kind)) return ICON_NEGATIVE_CLASS
  return kind === 'recovered' ? ICON_POSITIVE_CLASS : ICON_CLASS
}

const ACTIVITY_ROW_HEIGHT = 40
const ACTIVITY_ICON_SIZE = 14
const ACTIVITY_LINE_GAP = 7
const DATE_FORMAT = 'MMM d, yyyy'
const FULL_TIME_FORMAT = 'EEEE, MMMM d, yyyy, HH:mm:ss'

export const SubscriptionActivityList = ({
  activity,
}: {
  activity: SubscriptionActivityItem[]
}) => (
  <Box flexDirection="column">
    {activity.map(({ kind, label, detail, at, upcoming }, index) => {
      const Icon = upcoming ? Clock : ACTIVITY_ICONS[kind]
      return (
        <Box
          key={`${label}-${at}`}
          alignItems="start"
          gap="m"
          position="relative"
        >
          {index < activity.length - 1 && (
            <Box
              position="absolute"
              left={ACTIVITY_ICON_SIZE / 2 - 0.5}
              top={
                (ACTIVITY_ROW_HEIGHT + ACTIVITY_ICON_SIZE) / 2 +
                ACTIVITY_LINE_GAP
              }
              bottom={
                ACTIVITY_LINE_GAP -
                (ACTIVITY_ROW_HEIGHT - ACTIVITY_ICON_SIZE) / 2
              }
              borderLeftWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            />
          )}
          <Box height={ACTIVITY_ROW_HEIGHT} alignItems="center" flexShrink={0}>
            <Icon className={upcoming ? ICON_CLASS : getIconClass(kind)} />
          </Box>
          <Box flexDirection="column" flexGrow={1} minWidth={0}>
            <Box height={ACTIVITY_ROW_HEIGHT} alignItems="center">
              <Text color={upcoming ? 'muted' : 'default'} truncate>
                {label}
              </Text>
            </Box>
            {detail && (
              <div className="-mt-2 min-w-0 pb-2">
                <Text as="div" color="muted" truncate>
                  {detail}
                </Text>
              </div>
            )}
          </Box>
          <Box height={ACTIVITY_ROW_HEIGHT} alignItems="center" flexShrink={0}>
            <Tooltip>
              <TooltipTrigger>
                <Text as="span" color="muted" tabularNums>
                  {format(at, DATE_FORMAT)}
                </Text>
              </TooltipTrigger>
              <TooltipContent side="top" align="end">
                {format(at, FULL_TIME_FORMAT)}
              </TooltipContent>
            </Tooltip>
          </Box>
        </Box>
      )
    })}
  </Box>
)
