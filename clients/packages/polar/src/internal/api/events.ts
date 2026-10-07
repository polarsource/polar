import type { models, Polar } from '../../sdk'
import type { MemberIdentifier } from './utils'

export const ingestEvent = async (
  sdk: Polar,
  identifier: MemberIdentifier,
  name: string,
  timestamp: Date,
  metadata?: models.EventMetadataInput,
) => {
  const { inserted } = await sdk.events.ingest({
    events: [
      {
        ...identifier,
        name,
        timestamp: timestamp.toISOString(),
        ...(metadata !== undefined ? { metadata } : {}),
      },
    ],
  })

  return inserted
}
