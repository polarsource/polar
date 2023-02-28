import { queryClient } from '../api'
import { useEffect } from 'react'
import { useStore } from '../store'
import { getServerURL } from '../utils'

const onIssueUpdated = (payload) => {
  const cacheKey = [
    'issues',
    'repo',
    payload.organization_name,
    payload.repository_name,
  ]
  queryClient.invalidateQueries(cacheKey)
}

const dispatch = (event) => {
  const data = JSON.parse(event.data)
  switch (data.key) {
    case 'issue.updated':
      onIssueUpdated(data.payload)
    default:
      return
  }
}

export const useEventStream = () => {
  const currentOrganization = useStore((state) => state.currentOrganization)
  const currentRepository = useStore((state) => state.currentRepository)

  const getStreamURL = () => {
    const params: {
      organization_id?: string
      repository_id?: string
    } = {}

    if (currentOrganization) {
      params.organization_id = currentOrganization.id
    }
    if (currentRepository) {
      params.repository_id = currentRepository.id
    }

    const base = getServerURL('/api/v1/stream')
    const query = new URLSearchParams(params)
    return `${base}?${query.toString()}`
  }

  const streamURL = getStreamURL()

  useEffect(() => {
    if (!streamURL) {
      return
    }

    const connection = new EventSource(streamURL, {
      withCredentials: true,
    })
    // TODO: Add types for event. Just want to get the structure
    // up and running first before getting stuck in protocol land.
    connection.onmessage = (event) => {
      dispatch(event)
    }
    connection.onerror = (event) => connection.close
    return () => {
      // Cleanup
      connection.close()
    }
  }, [streamURL])

  return {}
}
