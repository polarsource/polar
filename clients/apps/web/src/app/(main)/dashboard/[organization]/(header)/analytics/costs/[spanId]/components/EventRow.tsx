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
  averageCost: number
  p99Cost: number
}

export function EventRow({
  eventType,
  event,
  organization,
  averageCost,
  p99Cost,
}: EventRowProps) {
  const costMetadata = (event.metadata as { _cost: { amount: string } })._cost
  const parsedCost = costMetadata ? Number(costMetadata.amount) : 0

  return (
    <tr>
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

            <CostDeviationBar
              eventCost={parsedCost}
              averageCost={averageCost}
              p99Cost={p99Cost}
            />
          </div>
        )}
      </td>
    </tr>
  )
}
