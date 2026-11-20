import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { ExportResultCode, type ExportResult } from '@opentelemetry/core'
import {
  createTokenClient,
  type IngestionEvent,
  type IngestionTokenConfig,
} from '../ingestion'

const convertAttributesToMetadata = (
  attributes: ReadableSpan['attributes'],
): Record<string, string | number | boolean> => {
  return Object.entries(attributes).reduce(
    (acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value
      } else if (typeof value === 'number') {
        acc[key] = value
      } else if (typeof value === 'boolean') {
        acc[key] = value
      } else if (value instanceof Date) {
        acc[key] = value.toISOString()
      }

      return acc
    },
    {} as Record<string, string | number | boolean>,
  )
}

const customerIdKey = 'customerId' as const
const externalCustomerIdKey = 'externalCustomerId' as const

const convertSpanToPolarEvent = (span: ReadableSpan): IngestionEvent | null => {
  const customerId = span.attributes[customerIdKey]
  const externalCustomerId = span.attributes[externalCustomerIdKey]

  if (customerId && typeof customerId === 'string') {
    return {
      name: span.name,
      customer_id: customerId,
      metadata: convertAttributesToMetadata(span.attributes),
      parent_id: span.parentSpanContext?.spanId,
      external_id: span.spanContext().spanId,
    }
  }

  if (externalCustomerId && typeof externalCustomerId === 'string') {
    return {
      name: span.name,
      external_customer_id: externalCustomerId,
      metadata: convertAttributesToMetadata(span.attributes),
      parent_id: span.parentSpanContext?.spanId,
      external_id: span.spanContext().spanId,
    }
  }

  return null
}

export class PolarTraceExporter implements SpanExporter {
  constructor(private options: IngestionTokenConfig) {}

  async export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ) {
    try {
      const spansWithCustomerId = spans.filter(
        (span) =>
          'customerId' in span.attributes ||
          'externalCustomerId' in span.attributes,
      )

      const payload = spansWithCustomerId
        .map(convertSpanToPolarEvent)
        .filter((event) => event !== null)

      const polar = createTokenClient(this.options)

      await polar.events.ingest({
        events: payload,
      })

      resultCallback({ code: ExportResultCode.SUCCESS })
    } catch (err) {
      resultCallback({ code: ExportResultCode.FAILED, error: err as Error })
    }
  }

  shutdown() {
    return Promise.resolve()
  }
}
