import type { models, Polar } from '../../sdk'
import type { MemberIdentifier, ActorSegment } from './utils'

export const ingestEvent = async (
  sdk: Polar,
  identifier: MemberIdentifier,
  name: string,
  timestamp: Date,
  actors?: ActorSegment[],
) => {
  const metadata: models.EventMetadataInput = actors ? { _actors: actors } : {}
  const { inserted } = await sdk.events.ingest({
    events: [
      {
        ...identifier,
        name,
        timestamp: timestamp.toISOString(),
        metadata,
      },
    ],
  })

  return inserted
}
