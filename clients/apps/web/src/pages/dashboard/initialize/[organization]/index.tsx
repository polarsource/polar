import SetupOrganization from 'components/Dashboard/Onboarding/SetupOrganization'
import SynchronizeRepositories from 'components/Dashboard/Onboarding/SynchronizeRepositories'
import { NextLayoutComponentType } from 'next'
import { useState } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const [showSetup, setShowSetup] = useState(false)
  const { org } = useCurrentOrgAndRepoFromURL()

  if (!org) {
    return <></>
  }

  return (
    <>
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

export default Page
