'use client'

import BadgeSetup from '@/components/Settings/Badge'
import Spinner from '@/components/Shared/Spinner'
import Head from 'next/head'
import { useSSE } from 'polarkit/hooks'
import { useState } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

export default function Page() {
  const [showControls, setShowControls] = useState<boolean>(false)
  const [syncedIssuesCount, setSyncIssuesCount] = useState<number>(0)
  const { org } = useCurrentOrgAndRepoFromURL()

  useSSE()

  if (!org) {
    return (
      <>
        <Head>
          <title>Polar | Setup</title>
        </Head>
        <div className="flex min-h-screen px-2 py-8 md:px-0">
          <div className="mx-auto space-y-8 md:my-auto md:w-[700px]">
            {!showControls && (
              <h1 className="flex-column mb-11 flex items-center justify-center text-center text-xl font-normal text-gray-500">
                Connecting repositories
                <span className="ml-4">
                  <Spinner />
                </span>
              </h1>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Polar | Setup {org.name}</title>
      </Head>
      <div className="flex min-h-screen px-2 py-8 md:px-0">
        <div className="mx-auto space-y-8 md:my-auto md:w-[700px]">
          {!showControls && (
            <h1 className="flex-column mb-11 flex items-center justify-center text-center text-xl font-normal text-gray-500">
              Connecting repositories
              <span className="ml-4">
                <Spinner />
              </span>
            </h1>
          )}

          {showControls && (
            <>
              <div className="text-center">
                <span className="rounded-2xl border border-gray-200 px-3 py-1 text-sm font-medium text-gray-500 dark:border-gray-700">
                  {syncedIssuesCount} issues fetched
                </span>
                <h1 className="mt-8 text-xl font-normal">
                  Setup the Polar funding badge
                </h1>
              </div>
            </>
          )}

          <BadgeSetup
            org={org}
            showControls={showControls}
            setShowControls={setShowControls}
            setSyncIssuesCount={setSyncIssuesCount}
            isSettingPage={false}
          />
        </div>
      </div>
    </>
  )
}

// Page.getLayout = (page: ReactElement) => {
//   return (
//     <Gatekeeper>
//       <>
//         <Topbar hideProfile={true} />
//         {page}
//       </>
//     </Gatekeeper>
//   )
// }

// export default Page
