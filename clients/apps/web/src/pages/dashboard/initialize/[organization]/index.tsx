import Gatekeeper from 'components/Dashboard/Gatekeeper/Gatekeeper'
import BadgeSetup from 'components/Settings/Badge'
import Spinner from 'components/Shared/Spinner'
import Topbar from 'components/Shared/Topbar'
import { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { ReactElement, useState } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const [showSetup, setShowSetup] = useState<boolean>(false)
  const [syncedIssuesCount, setSyncIssuesCount] = useState<number>(0)
  const { org } = useCurrentOrgAndRepoFromURL()

  if (!org) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar | Setup {org.name}</title>
      </Head>
      <div className="flex h-screen">
        <div className="m-auto w-[700px] space-y-8">
          {!showSetup && (
            <h1 className="flex-column mb-11 flex items-center justify-center text-center text-xl font-normal text-gray-500">
              Connecting repositories
              <span className="ml-4">
                <Spinner />
              </span>
            </h1>
          )}

          {showSetup && (
            <>
              <div className="text-center">
                <span className="rounded-2xl border border-gray-200 py-1 px-3 text-sm font-medium text-gray-500">
                  {syncedIssuesCount} issues fetched
                </span>
                <h1 className="mt-8 text-xl font-normal text-gray-900">
                  Embed the Polar badge to get backers
                </h1>
              </div>
            </>
          )}

          <BadgeSetup
            org={org}
            showSetup={showSetup}
            setShowSetup={setShowSetup}
            setSyncIssuesCount={setSyncIssuesCount}
            isSettingPage={false}
          />
        </div>
      </div>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <>
      <Topbar hideProfile={true} />
      <Gatekeeper>{page}</Gatekeeper>
    </>
  )
}

export default Page
