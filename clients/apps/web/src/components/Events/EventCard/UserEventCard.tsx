import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import { EventCardBase } from './EventCardBase'

export const useMetadata = (event: schemas['Event']) => {
  return useMemo(() => {
    const metadata = { ...event.metadata }

    // Filter out structured keys that are rendered by specialized cards
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _llm, _cost, ...rest } = metadata as Record<string, unknown>

    return Object.keys(rest).length > 0 ? rest : undefined
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
