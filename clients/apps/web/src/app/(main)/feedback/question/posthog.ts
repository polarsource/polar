import {
  aiTracing,
  type AITracingContext,
  flushAITracing,
} from '@/utils/ai/tracing'

export type TracingContext = AITracingContext

export const feedbackTracing = (context: TracingContext) =>
  aiTracing(context.conversationId ? context : null)

export const flushPostHog = (): void => {
  void flushAITracing()
}
