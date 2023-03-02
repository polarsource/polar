import { useEffect } from 'react'
import { getServerURL } from '../../utils'
import { onIssueUpdated } from './issues'
import EventEmitter from 'eventemitter3'

const ACTIONS: {
  [key: string]: (payload: any) => void
} = {
  'issue.updated': onIssueUpdated,
}

const emitter = new EventEmitter()

export const useSSE = (
  organizationId?: string,
  repositoryId?: string,
): EventEmitter => {
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

  let streamURL: string
  if (params.organization_id || params.repository_id) {
    const base = getServerURL('/api/v1/stream')
    const query = new URLSearchParams(params)
    streamURL = `${base}?${query.toString()}`
  }

  useEffect(() => {
    if (!streamURL) {
      return
    }

    const connection = new EventSource(streamURL, {
      withCredentials: true,
    })

    const cleanup = () => {
      connection.close()
    }
    // TODO: Add types for event. Just want to get the structure
    // up and running first before getting stuck in protocol land.
    connection.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const handler = ACTIONS[data.key]
      if (handler) {
        handler(data.payload)
      }
      emitter.emit(data.key, data.payload)
    }

    connection.onerror = (event) => cleanup
    return cleanup
  }, [streamURL])

  return emitter
}
