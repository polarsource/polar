import { trace } from '@opentelemetry/api'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { PolarTraceExporter } from '@polar-sh/ingestion'
import { after } from 'next/server'

const provider = new NodeTracerProvider({
  spanProcessors: [
    new SimpleSpanProcessor(
      new PolarTraceExporter({ accessToken: process.env.POLAR_ACCESS_TOKEN }),
    ),
  ],
})
provider.register()

const tracer = trace.getTracer('my-app')

export async function POST() {
  return tracer.startActiveSpan('report_generated', async (span) => {
    // Only spans with a customerId or externalCustomerId attribute are ingested
    span.setAttributes({ externalCustomerId: 'user_123', pages: 12 })
    span.end()

    after(() => provider.forceFlush())

    return Response.json({})
  })
}
