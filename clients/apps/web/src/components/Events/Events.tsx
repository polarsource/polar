import { schemas } from '@polar-sh/client'
import { EventRow } from './EventRow'

export const Events = ({
  events,
  organization,
}: {
  events: schemas['Event'][]
  organization: schemas['Organization']
}) => {
  return (
    <div className="flex flex-col gap-y-3">
      {events.map((event) => (
        <EventRow key={event.id} event={event} organization={organization} />
      ))}
    </div>
  )
}
