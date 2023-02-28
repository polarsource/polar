import { useEffect } from 'react'
import { getServerURL } from '../../utils'
import { onIssueUpdated } from './issues'

const ACTIONS: {
  [key: string]: (payload: any) => void
} = {
  'issue.updated': onIssueUpdated,
}

export const useSSE = (organizationId?: string, repositoryId?: string) => {
  const params: {
    organization_id?: string
    repository_id?: string
  } = {}

  if (organizationId) {
    params.organization_id = organizationId
  }
  if (repositoryId) {
    params.repository_id = repositoryId
  }

  const base = getServerURL('/api/v1/stream')
  const query = new URLSearchParams(params)
  const streamURL = `${base}?${query.toString()}`

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
      const data = JSON.parse(event.data)
      const handler = ACTIONS[data.key]
      if (handler) {
        handler(data.payload)
      }
    }
    connection.onerror = (event) => connection.close
    return () => {
      // Cleanup
      connection.close()
    }
  }, [streamURL])

  return {}
}
