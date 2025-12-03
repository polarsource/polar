import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import { EventCardBase } from './EventCardBase'

export const useMetadata = (event: schemas['Event']) => {
  return useMemo(() => {
    const metadata = { ...event.metadata }
    const metadataWithoutPrivateFields = Object.entries(metadata).reduce(
      (acc, [key, value]) => {
        return key.startsWith('_') ? acc : { ...acc, [key]: value }
      },
      {},
    )

    return Object.keys(metadataWithoutPrivateFields).length > 0
      ? metadataWithoutPrivateFields
      : undefined
  }, [event])
}

export const UserEventCard = ({ event }: { event: schemas['Event'] }) => {
  const metadataToRender = useMetadata(event)

  if (!metadataToRender) {
    return null
  }

  return (
    <EventCardBase>
      <pre className="flex p-2 font-mono select-text">
        {JSON.stringify(metadataToRender, null, 2)}
      </pre>
    </EventCardBase>
  )
}
