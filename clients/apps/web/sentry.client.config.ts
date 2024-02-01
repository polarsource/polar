// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import { CONFIG } from 'polarkit'
import posthog from 'posthog-js'

Sentry.init({
  dsn: CONFIG.SENTRY_DSN,
  environment: CONFIG.ENVIRONMENT,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    new Sentry.Replay({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    new posthog.SentryIntegration(posthog, 'polar-sh', 4505047079976960),
  ],

  beforeSend(event, hint) {
    const error = hint.originalException as any
    /** Filter an error caused by Darkreader on Firefox */
    if (
      error &&
      error.message &&
      error.message.match(/WeakMap key undefined/i)
    ) {
      return null
    }
    return event
  },
})
