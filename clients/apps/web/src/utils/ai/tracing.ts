import { OpenTelemetry } from '@ai-sdk/otel'
import {
  AlwaysOnSampler,
  BasicTracerProvider,
} from '@opentelemetry/sdk-trace-base'
import { PostHogSpanProcessor } from '@posthog/ai/otel'

export interface AITracingContext {
  userId: string
  conversationId?: string
  organizationId?: string
}

type AIRuntimeContext = {
  distinctId: string
  sessionId?: string
  groups?: Record<string, string>
}

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_TOKEN

const spanProcessor = projectToken
  ? new PostHogSpanProcessor({
      projectToken,
      host: 'https://us.i.posthog.com',
    })
  : null

// A dedicated tracer: Sentry's global tracer provider samples traces, which
// would drop most AI generations before they reach PostHog.
const integration = spanProcessor
  ? new OpenTelemetry({
      tracer: new BasicTracerProvider({
        sampler: new AlwaysOnSampler(),
        spanProcessors: [spanProcessor],
      }).getTracer('polar-web-ai'),
      enrichSpan: ({ runtimeContext }) => {
        const context = runtimeContext as Partial<AIRuntimeContext> | undefined
        return {
          'posthog.distinct_id': context?.distinctId,
          $ai_session_id: context?.sessionId,
          $groups: context?.groups ? JSON.stringify(context.groups) : undefined,
        }
      },
    })
  : null

export const aiTracing = (context: AITracingContext | null) => {
  if (!integration || !context) {
    return {}
  }
  const runtimeContext: AIRuntimeContext = {
    distinctId: context.userId,
    sessionId: context.conversationId,
    groups: context.organizationId
      ? { organization: context.organizationId }
      : undefined,
  }
  return {
    runtimeContext,
    telemetry: {
      integrations: integration,
      includeRuntimeContext: {
        distinctId: true,
        sessionId: true,
        groups: true,
      },
    },
  }
}

export const flushAITracing = async (): Promise<void> => {
  // Telemetry should never break the user flow.
  await spanProcessor?.forceFlush().catch(() => {})
}
