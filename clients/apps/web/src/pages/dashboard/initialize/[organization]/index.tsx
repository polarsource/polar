import Gatekeeper from 'components/Dashboard/Gatekeeper/Gatekeeper'
import SetupOrganization from 'components/Dashboard/Onboarding/SetupOrganization'
import SynchronizeRepositories from 'components/Dashboard/Onboarding/SynchronizeRepositories'
import Topbar from 'components/Shared/Topbar'
import { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { ReactElement, useState } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const [showSetup, setShowSetup] = useState(false)
  const { org } = useCurrentOrgAndRepoFromURL()

  if (!org) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar {org.name}</title>
      </Head>
      <div className="flex h-screen">
        <div className="m-auto w-[700px]">
          {showSetup && <SetupOrganization org={org} />}
          {!showSetup && (
            <SynchronizeRepositories
              org={org}
              onContinue={() => {
                setShowSetup(true)
              }}
            />
          )}
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
