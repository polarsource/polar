import type { models, Polar } from '../../sdk'
import type { MemberIdentifier, ActorSegment } from './utils'

// {
//   "external_customer_id": "acme",
//   "external_member_id": "alice",
//   "name": "tool_call",
//   "timestamp": "2026-10-07T12:00:00.000Z",
//   "metadata": {
//     "_actors": [
//       { "external_customer_id": "acme" },
//       { "external_entity_id": "engineering" },
//       { "external_member_id": "alice" },
//       { "external_entity_id": "coding_agent" }
//     ]
//   }
// }
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
