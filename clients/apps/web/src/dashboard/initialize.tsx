import { OrganizationSchema } from 'polarkit/api/client'
import { requireAuth } from 'polarkit/hooks'
import { useUserOrganizations } from 'polarkit/hooks'
import { useParams } from 'react-router-dom'
import { useStore } from 'polarkit/store'

import { SynchronizeRepositories } from '../components/Dashboard/Onboarding/SynchronizeRepositories'

const Initialize = () => {
  const { orgSlug } = useParams()
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser?.id)
  const currentOrg = useStore((state) => state.currentOrg)
  const setCurrentOrg = useStore((state) => state.setCurrentOrg)

  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  if (!currentOrg || currentOrg.name !== orgSlug) {
    const org = userOrgQuery.data.find(
      (org: OrganizationSchema) => org.name === orgSlug,
    )
    setCurrentOrg(org)
  }

  return (
    <>
      <div className="flex h-screen">
        <div className="w-[700px] m-auto">
          <SynchronizeRepositories org={currentOrg} />
        </div>
      </div>
    </>
  )
}

export default Initialize
