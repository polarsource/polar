import EventEmitter from 'eventemitter3'
import { useEffect } from 'react'
import { getServerURL } from '../../utils'
import { onIssueUpdated } from './issues'

const ACTIONS: {
  [key: string]: (payload: any) => void
} = {
  'issue.updated': onIssueUpdated,
}

const emitter = new EventEmitter()

export const useSSE = (
  platform?: string,
  orgName?: string,
  repoName?: string,
): EventEmitter => {
  let streamURL = getServerURL('/api/v1')
  if (!orgName && !repoName) {
    streamURL += '/user'
  } else {
    streamURL += `/${platform}/${orgName}`
    if (repoName) {
      streamURL += `/${repoName}`
    }
  }
  streamURL += '/stream'

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
