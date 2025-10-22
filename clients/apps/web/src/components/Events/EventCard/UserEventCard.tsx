import { schemas } from '@polar-sh/client'
import { EventCardBase } from './EventCardBase'

export const UserEventCard = ({ event }: { event: schemas['Event'] }) => {
  return (
    <EventCardBase>
      <pre className="flex p-2 select-text">
        {JSON.stringify(event.metadata, null, 2)}
      </pre>
    </EventCardBase>
  )
}
