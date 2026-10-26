// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { CONFIG } from '@/utils/config'
import { redactClaimTokens } from '@/utils/telemetry'
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: CONFIG.SENTRY_DSN,
  environment: CONFIG.ENVIRONMENT,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  beforeSend: (event) => redactClaimTokens(event),

  beforeSendTransaction: (event) => redactClaimTokens(event),

  beforeBreadcrumb: (breadcrumb) => redactClaimTokens(breadcrumb),
})
