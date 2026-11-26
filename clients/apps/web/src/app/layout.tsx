import '../styles/globals.css'

import SandboxBanner from '@/components/Sandbox/SandboxBanner'
import { SessionRefreshModal } from '@/components/SessionRefresh/SessionRefreshModal'
import { getExperimentNames } from '@/experiments'
import { getDistinctId } from '@/experiments/distinct-id'
import { ExperimentProvider } from '@/experiments/ExperimentProvider'
import { getExperiments } from '@/experiments/server'
import { CONFIG } from '@/utils/config'
import { GOOGLE_ANALYTICS_CONSENT_DEFAULT_SCRIPT } from '@/utils/googleAnalyticsConsent'
import { Viewport } from 'next/types'
import {
  PolarMotionProvider,
  PolarNuqsProvider,
  PolarPostHogProvider,
  PolarQueryClientProvider,
} from './providers'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const distinctId = await getDistinctId()
  const experimentVariants = await getExperiments(getExperimentNames(), {
    distinctId,
  })

  return (
    <html
      lang="en"
      translate="no"
      suppressHydrationWarning
      className="antialiased"
    >
      <head>
        {CONFIG.GOOGLE_ANALYTICS_ID && (
          <script
            // oxlint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: GOOGLE_ANALYTICS_CONSENT_DEFAULT_SCRIPT,
            }}
          />
        )}
        {CONFIG.ENVIRONMENT === 'development' ? (
          <link href="/favicon-dev.png" rel="icon" />
        ) : (
          <link href="/favicon.png" rel="icon" />
        )}
      </head>
      <body style={{ textRendering: 'optimizeLegibility' }}>
        <ExperimentProvider experiments={experimentVariants}>
          <PolarPostHogProvider>
            <PolarQueryClientProvider>
              <PolarNuqsProvider>
                <PolarMotionProvider>
                  {CONFIG.IS_SANDBOX && <SandboxBanner />}
                  <SessionRefreshModal />
                  {children}
                </PolarMotionProvider>
              </PolarNuqsProvider>
            </PolarQueryClientProvider>
          </PolarPostHogProvider>
        </ExperimentProvider>
      </body>
    </html>
  )
}
