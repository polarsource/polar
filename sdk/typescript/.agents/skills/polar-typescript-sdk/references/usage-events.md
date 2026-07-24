# Usage-event ingestion

Use these instructions whenever implementing metered usage or sending events used by a Polar meter.

## Ingest events

Send events from trusted server-side code. Use the application's customer ID as `external_customer_id` when the Polar customer has the same `external_id`.

```typescript
import { createPolar } from "@polar-sh/sdk/2026-04";

const accessToken = process.env.POLAR_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error("POLAR_ACCESS_TOKEN is required");
}

const polar = createPolar({ accessToken });
const result = await polar.events.ingest({
  events: [
    {
      name: "ai_generation",
      external_customer_id: "usr_123",
      external_id: "usage_01K0E6Y8W4H7D3F2A1B9C5M6N7",
      metadata: {
        input_tokens: 1200,
        output_tokens: 350,
      },
    },
  ],
});

console.log({
  inserted: result.inserted,
  duplicates: result.duplicates ?? 0,
});
```

Use an event name and metadata keys that exactly match the configured meter filter and aggregation. Preserve numeric values as numbers rather than formatted strings.

## Make ingestion retry-safe

Assign each logical event a stable, globally unique `external_id` when the application records the usage. Persist that identifier before sending the event.

When a request times out or is retried:

- Send the same logical event with the same `external_id`.
- Do not generate a replacement ID.
- Treat the `duplicates` count as successful deduplication, not as newly billed usage.
- Reconcile unexpected partial batch results before discarding the local delivery record.

Batch events when appropriate, but keep every event independently identifiable. Associate each event with exactly one `customer_id` or `external_customer_id`.

## Understand timestamps and balances

Events are immutable after ingestion. Set `timestamp` to an ISO 8601 string when preserving the time the usage occurred.

Polar attributes an event to a billing period according to when Polar receives it, not only its supplied timestamp. Replaying an old event does not revise an already-closed invoice.

Event ingestion records usage regardless of the customer's remaining meter balance. Query or cache customer state and enforce hard usage limits in the application before performing the metered action.
