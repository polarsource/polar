// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { CONFIG } from '@/utils/config'
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: CONFIG.SENTRY_DSN,
  environment: CONFIG.ENVIRONMENT,

  // Add optional integrations for additional features
  integrations: [
    Sentry.httpClientIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,

  // Enable distributed tracing to API
  tracePropagationTargets: [/^https:\/\/api\.polar\.sh/],

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  ignoreErrors: [/WeakMap key undefined/i],

  beforeSend: (event) => {
    // Do not flag PostHog errors
    if (
      event.request?.url?.includes('/ingest/flags') ||
      event.request?.url?.includes('/ingest/batch')
    ) {
      return null
    }

    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
