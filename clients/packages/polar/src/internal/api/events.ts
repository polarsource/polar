import type { Polar } from '../../sdk'
import type { MemberIdentifier } from './utils'

export const ingestEvent = async (
  sdk: Polar,
  identifier: MemberIdentifier,
  name: string,
  timestamp: Date,
) => {
  const { inserted } = await sdk.events.ingest({
    events: [
      {
        ...identifier,
        name,
        timestamp: timestamp.toISOString(),
      },
    ],
  })

  return inserted
}
