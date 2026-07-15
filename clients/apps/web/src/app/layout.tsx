import '../styles/globals.css'

import SandboxBanner from '@/components/Sandbox/SandboxBanner'
import { SessionRefreshModal } from '@/components/SessionRefresh/SessionRefreshModal'
import { getExperimentNames } from '@/experiments'
import { getDistinctId } from '@/experiments/distinct-id'
import { ExperimentProvider } from '@/experiments/ExperimentProvider'
import { getExperiments } from '@/experiments/server'
import { UserContextProvider } from '@/providers/auth'
import { CONFIG } from '@/utils/config'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { schemas } from '@polar-sh/client'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { Viewport } from 'next/types'
import {
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
  let authenticatedUser: schemas['UserRead'] | undefined = undefined
  let userOrganizations: schemas['OrganizationWithRole'][] = []

  try {
    authenticatedUser = await getAuthenticatedUser()
    userOrganizations = await getUserOrganizations()
  } catch (e) {
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
      throw e
    }
  }

  const distinctId = await getDistinctId()
  const experimentVariants = await getExperiments(getExperimentNames(), {
    distinctId,
  })

  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        {CONFIG.ENVIRONMENT === 'development' ? (
          <>
            <link
              href="/favicon-dev.png"
              rel="icon"
              media="(prefers-color-scheme: dark)"
            />
            <link
              href="/favicon-dev-dark.png"
              rel="icon"
              media="(prefers-color-scheme: light)"
            />
          </>
        ) : (
          <>
            <link
              href="/favicon.png"
              rel="icon"
              media="(prefers-color-scheme: dark)"
            />
            <link
              href="/favicon-dark.png"
              rel="icon"
              media="(prefers-color-scheme: light)"
            />
          </>
        )}
      </head>
      <body style={{ textRendering: 'optimizeLegibility' }}>
        <ExperimentProvider experiments={experimentVariants}>
          <UserContextProvider
            user={authenticatedUser}
            userOrganizations={userOrganizations}
          >
            <PolarPostHogProvider>
              <PolarQueryClientProvider>
                <PolarNuqsProvider>
                  {CONFIG.IS_SANDBOX && <SandboxBanner />}
                  <SessionRefreshModal />
                  {children}
                </PolarNuqsProvider>
              </PolarQueryClientProvider>
            </PolarPostHogProvider>
          </UserContextProvider>
        </ExperimentProvider>
      </body>
    </html>
  )
}
