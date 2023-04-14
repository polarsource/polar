import SetupOrganization from 'components/Dashboard/Onboarding/SetupOrganization'
import SynchronizeRepositories from 'components/Dashboard/Onboarding/SynchronizeRepositories'
import { NextLayoutComponentType } from 'next'
import { useCurrentOrgAndRepoFromURL } from 'polarkit/hooks'
import { useState } from 'react'

const Page: NextLayoutComponentType = () => {
  const [showSetup, setShowSetup] = useState(false)
  const [currentOrg, currentRepo] = useCurrentOrgAndRepoFromURL()

  return (
    <>
      <div className="flex h-screen">
        <div className="m-auto w-[700px]">
          {showSetup && <SetupOrganization org={currentOrg} />}
          {!showSetup && (
            <SynchronizeRepositories
              org={currentOrg}
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
