import {
  type CloudflareOptions,
  type ErrorEvent,
  captureException,
} from '@sentry/cloudflare'
import { version } from '../package.json'
import { redact } from './redact'
import type { ToolError, ToolErrorKind } from './results'

const REPORTED_KINDS = new Set<ToolErrorKind | undefined>([
  'internal',
  'sandbox',
  undefined,
])

export const scrub = (event: ErrorEvent) => {
  if (event.request) {
    event.request = {
      ...(event.request.method && { method: event.request.method }),
      ...(event.request.url && { url: event.request.url.split('?')[0] }),
    }
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = redact(exception.value)
    }
  }
  if (event.message) {
    event.message = redact(event.message)
  }
  delete event.user
  return event
}

export const sentryOptions = (
  env: Pick<Env, 'SENTRY_DSN' | 'SENTRY_ENVIRONMENT' | 'SENTRY_RELEASE'>,
): CloudflareOptions => ({
  dsn: env.SENTRY_DSN || undefined,
  environment: env.SENTRY_ENVIRONMENT,
  release: env.SENTRY_RELEASE || `polar-mcp@${version}`,
  tracesSampleRate: 0,
  dataCollection: { userInfo: false, httpBodies: [] },
  beforeSend: scrub,
})

export const reportToolFailure = (
  error: ToolError,
  tool: string | undefined,
) => {
  if (!REPORTED_KINDS.has(error.kind)) return
  captureException(error.cause ?? error, {
    tags: { tool: tool ?? 'unknown', kind: error.kind ?? 'internal' },
  })
}

export const reportCrash = (cause: unknown, tool: string | undefined) =>
  captureException(cause, { tags: { tool: tool ?? 'unknown', kind: 'crash' } })
