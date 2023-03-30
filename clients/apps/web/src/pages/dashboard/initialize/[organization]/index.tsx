import SetupOrganization from 'components/Dashboard/Onboarding/SetupOrganization'
import SynchronizeRepositories from 'components/Dashboard/Onboarding/SynchronizeRepositories'
import { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { OrganizationRead } from 'polarkit/api/client'
import { requireAuth, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { useState } from 'react'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization } = router.query
  const { currentUser } = requireAuth()
  const [showSetup, setShowSetup] = useState(false)
  const userOrgQuery = useUserOrganizations(currentUser)
  const currentOrg = useStore((state) => state.currentOrg)
  const setCurrentOrg = useStore((state) => state.setCurrentOrg)

  const orgSlug = typeof organization === 'string' ? organization : ''

  if (userOrgQuery.isLoading) return <div></div>
  if (!userOrgQuery.isSuccess) return <div>Error</div>

  if (!currentOrg || currentOrg.name !== orgSlug) {
    const org = userOrgQuery.data.find(
      (org: OrganizationRead) => org.name === orgSlug,
    )
    setCurrentOrg(org)
  }

  if (!currentOrg) {
    return <div>Loading org...</div>
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

export default Page
