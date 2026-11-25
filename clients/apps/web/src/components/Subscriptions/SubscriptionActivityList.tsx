import {
  type SubscriptionActivityItem,
  type SubscriptionActivityKind,
} from '@/utils/subscriptionSummary'
import { EventTimestamp } from '@/components/Events/EventTimestamp'
import { Text, Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  FlaskConical,
  Gauge,
  Package,
  Plus,
  RefreshCw,
} from '@polar-sh/orbit/icons'
import { format } from 'date-fns'
import Link from 'next/link'
import { ORDER_PAYMENTS_SECTION_ID } from '../Orders/OrderPaymentsTable'

const ACTIVITY_ICONS: Record<SubscriptionActivityKind, typeof Clock> = {
  started: Plus,
  trial: FlaskConical,
  converted: CircleCheck,
  renewal: RefreshCw,
  update: Package,
  usage: Gauge,
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

const LINK_CLASS = 'min-w-0 truncate hover:underline'

export const SubscriptionActivityList = ({
  activity,
  organizationSlug,
}: {
  activity: SubscriptionActivityItem[]
  organizationSlug: string
}) => (
  <Box flexDirection="column">
    {activity.map((item, index) => {
      const { kind, label, detail, at, upcoming, orderId, isPayment } = item
      const Icon = upcoming ? Clock : ACTIVITY_ICONS[kind]
      // An event with an order opens it, at its payments when it is about one.
      const href = orderId
        ? `/dashboard/${organizationSlug}/sales/${orderId}${isPayment ? `#${ORDER_PAYMENTS_SECTION_ID}` : ''}`
        : undefined
      const name = (
        <Text color={upcoming ? 'muted' : 'default'} truncate>
          {label}
        </Text>
      )
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
              {href ? (
                <Link href={href} className={LINK_CLASS}>
                  {name}
                </Link>
              ) : (
                name
              )}
            </Box>
            {detail && (
              <div className="-mt-2 min-w-0 pb-2">
                <Truncated>
                  <Text as="span" color="muted">
                    {detail}
                  </Text>
                </Truncated>
              </div>
            )}
          </Box>
          <Box height={ACTIVITY_ROW_HEIGHT} alignItems="center" flexShrink={0}>
            <EventTimestamp timestamp={new Date(at).toISOString()}>
              <Text as="span" color="muted" tabularNums>
                {format(at, DATE_FORMAT)}
              </Text>
            </EventTimestamp>
          </Box>
        </Box>
      )
    })}
  </Box>
)
