import { useState, useEffect } from 'react'
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
  const setCurrentOrg = useStore((state) => state.setCurrentOrg)
  const emitter = useSSE(currentOrg?.id)

  const [events, setEvents] = useState([])

  const onIssueSynced = (data) => {
    setEvents((events) => [...events, data])
  }

  const onIssueSyncCompleted = (data) => {
    console.log('onIssueSyncCompleted', data)
  }

  useEffect(() => {
    emitter.on('issue.synced', onIssueSynced)
    emitter.on('issue.sync.completed', onIssueSyncCompleted)

    return () => {
      emitter.off('issue.synced', onIssueSynced)
      emitter.off('issue.sync.completed', onIssueSyncCompleted)
    }
  }, [])

  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  if (!currentOrg) {
    const org = userOrgQuery.data.find((org) => org.name === orgSlug)
    setCurrentOrg(org)
  }

  return (
    <>
      <h1>Onboarding</h1>
      <p>Let's create some magic: {orgSlug}</p>
      <ul>
        {events.map((e) => (
          <li>{JSON.stringify(e)}</li>
        ))}
      </ul>
    </>
  )
}

export default Onboarding
