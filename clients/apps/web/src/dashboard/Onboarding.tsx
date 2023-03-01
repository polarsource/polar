import { requireAuth } from 'polarkit/hooks'
import { useUserOrganizations } from 'polarkit/hooks'
import { useParams } from 'react-router-dom'
import { useSSE } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'

const Onboarding = () => {
  const { orgSlug } = useParams()
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser?.id)
  const currentOrg = useStore((state) => state.currentOrg)
  useSSE(currentOrg?.id)

  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  return (
    <>
      <h1>Onboarding</h1>
      <p>Let's create some magic: {orgSlug}</p>
    </>
  )
}

export default Onboarding
