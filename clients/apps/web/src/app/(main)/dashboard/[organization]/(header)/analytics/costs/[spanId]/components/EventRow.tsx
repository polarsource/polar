'use client'

import { EventCustomer } from '@/components/Events/EventCustomer'
import { formatSubCentCurrency } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { CostDeviationBar } from './CostDeviationBar'

interface EventRowProps {
  eventType: schemas['EventType']
  event: schemas['Event']
  organization: schemas['Organization']
  costDeviationMetadata?: {
    average: number
    p10: number
    p90: number
  }
  showEventType?: boolean
}

export function EventRow({
  eventType,
  event,
  organization,
  costDeviationMetadata,
  showEventType = true,
}: EventRowProps) {
  const costMetadata = (event.metadata as { _cost: { amount: string } })._cost
  const parsedCost = costMetadata ? Number(costMetadata.amount) : 0

  return (
    <tr>
      {showEventType && (
        <td className="p-2">
          <Link
            href={`/dashboard/${organization.slug}/analytics/costs/${eventType.id}`}
            className="dark:text-polar-500 text-sm text-gray-500"
          >
            {eventType.label}
          </Link>
        </td>
      )}

      <td className="p-2">
        <Link
          href={`/dashboard/${organization.slug}/analytics/costs/${eventType.id}/${event.id}`}
          className="text-sm font-medium"
        >
          {event.label}
        </Link>
      </td>

      <td className="p-2">
        <EventCustomer event={event} />
      </td>

      <td className="dark:text-polar-500 p-2 text-sm text-gray-600">
        <FormattedDateTime datetime={event.timestamp} resolution="time" />
      </td>

      <td className="p-2 text-right text-sm tabular-nums">
        {costMetadata && (
          <div className="ml-auto flex flex-row items-center justify-end gap-x-3">
            <span className="font-mono">
              {formatSubCentCurrency(
                parsedCost,
                (
                  event.metadata as {
                    _cost: { amount: string; currency: string }
                  }
                )._cost.currency ?? 'usd',
              )}
            </span>

            {costDeviationMetadata && (
              <CostDeviationBar
                eventCost={parsedCost}
                averageCost={costDeviationMetadata.average}
                p10Cost={costDeviationMetadata.p10}
                p90Cost={costDeviationMetadata.p90}
              />
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
