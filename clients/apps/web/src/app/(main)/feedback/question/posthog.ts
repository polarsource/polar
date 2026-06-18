import { withTracing } from '@posthog/ai'
import type { LanguageModel } from 'ai'
import { PostHog } from 'posthog-node'

export const phClient = process.env.NEXT_PUBLIC_POSTHOG_TOKEN
  ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_TOKEN, {
      host: 'https://us.i.posthog.com',
    })
  : null

export interface TracingContext {
  userId: string
  conversationId?: string
  organizationId?: string
}

// `ai`'s `LanguageModel` is a union that also allows bare model-id strings.
// `withTracing` only accepts the structured provider model types, so narrow
// the helper's input to those.
type WrappableModel = Exclude<LanguageModel, string>

export const wrapWithTracing = <T extends WrappableModel>(
  model: T,
  context: TracingContext,
): T => {
  if (!phClient || !context.conversationId) return model
  return withTracing(model, phClient, {
    posthogDistinctId: context.userId,
    posthogTraceId: context.conversationId,
    posthogGroups: context.organizationId
      ? { organization: context.organizationId }
      : undefined,
  }) as T
}

export const flushPostHog = (): void => {
  if (phClient) {
    void phClient.flush().catch(() => {
      // Avoid noisy errors if PostHog is unreachable — telemetry should
      // never break the user flow.
    })
  }
}
