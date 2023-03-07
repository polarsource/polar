import { OrganizationRead } from 'polarkit/api/client'
import { requireAuth, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import SetupOrganization from '../components/Dashboard/Onboarding/SetupOrganization'
import SynchronizeRepositories from '../components/Dashboard/Onboarding/SynchronizeRepositories'

const Initialize = () => {
  const { orgSlug } = useParams()
  const { currentUser } = requireAuth()
  const [showSetup, setShowSetup] = useState(false)
  const userOrgQuery = useUserOrganizations(currentUser?.id)
  const currentOrg = useStore((state) => state.currentOrg)
  const setCurrentOrg = useStore((state) => state.setCurrentOrg)

  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  if (!currentOrg || currentOrg.name !== orgSlug) {
    const org = userOrgQuery.data.find(
      (org: OrganizationRead) => org.name === orgSlug,
    )
    setCurrentOrg(org)
  }

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

export default Initialize
