import { OpenTelemetry } from '@ai-sdk/otel'
import { PostHogSpanProcessor } from '@posthog/ai/otel'
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
import { registerTelemetry } from 'ai'

type TelemetryGlobal = typeof globalThis & {
  polarAISpanProcessor?: PostHogSpanProcessor
}

export interface AITracingContext {
  userId: string
  conversationId?: string
  organizationId?: string
}

export const aiTracing = (context: AITracingContext) => ({
  runtimeContext: {
    userId: context.userId,
    conversationId: context.conversationId,
    organizationId: context.organizationId,
  },
  telemetry: {
    isEnabled: Boolean(context.conversationId),
    recordInputs: false,
    recordOutputs: false,
    includeRuntimeContext: {
      userId: true,
      conversationId: true,
      organizationId: true,
    },
  },
})

export function registerAITelemetry() {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_TOKEN
  const telemetryGlobal = globalThis as TelemetryGlobal
  if (!projectToken || telemetryGlobal.polarAISpanProcessor) return

  const processor = new PostHogSpanProcessor({
    projectToken,
    host: 'https://us.i.posthog.com',
  })
  const tracerProvider = new BasicTracerProvider({
    spanProcessors: [processor],
  })
  registerTelemetry(
    new OpenTelemetry({
      tracer: tracerProvider.getTracer('polar-ai'),
      enrichSpan: ({ runtimeContext }) => {
        const { userId, conversationId, organizationId } = runtimeContext ?? {}
        return {
          posthogDistinctId: typeof userId === 'string' ? userId : undefined,
          'gen_ai.conversation.id':
            typeof conversationId === 'string' ? conversationId : undefined,
          'posthogGroups.organization':
            typeof organizationId === 'string' ? organizationId : undefined,
        }
      },
    }),
  )
  telemetryGlobal.polarAISpanProcessor = processor
}

export async function flushAITelemetry() {
  try {
    await (globalThis as TelemetryGlobal).polarAISpanProcessor?.forceFlush()
  } catch {
    // Telemetry failures must not change AI responses.
  }
}
