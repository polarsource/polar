import { useEventTypes } from '@/hooks/queries/event_types'
import { schemas } from '@polar-sh/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { ArrowUpRight } from '@polar-sh/orbit/icons'
import { differenceInDays, endOfDay, startOfDay, subDays } from 'date-fns'
import Link from 'next/link'
import { explorerPath } from './ExplorerModeSwitch'

const DEFAULT_RANGE_DAYS = 30

// Opens the event's type in Costs mode. Events don't carry their type ID, so
// it's looked up by name.
export const EventCostsLink = ({
  event,
  organization,
}: {
  event: schemas['Event']
  organization: schemas['Organization']
}) => {
  const { data } = useEventTypes(organization.id, { query: event.name })
  const eventType = data?.items.find((item) => item.name === event.name)
  if (!eventType?.id) return null

  const timestamp = new Date(event.timestamp)
  const query = new URLSearchParams({ type: eventType.id })
  // The default range is the last 30 days; older events need their own window.
  if (differenceInDays(new Date(), timestamp) >= DEFAULT_RANGE_DAYS) {
    query.set(
      'startDate',
      startOfDay(subDays(timestamp, DEFAULT_RANGE_DAYS - 1)).toISOString(),
    )
    query.set('endDate', endOfDay(timestamp).toISOString())
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`${explorerPath(organization.slug, 'costs')}?${query}`}
          aria-label={`Open ${eventType.label} in Costs`}
          className="dark:text-polar-500 dark:hover:bg-polar-700 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>Open in Costs</TooltipContent>
    </Tooltip>
  )
}
