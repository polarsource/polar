import { getServerURL } from '@/utils/api'
import EventEmitter from 'eventemitter3'
import { useEffect } from 'react'
import { onBenefitGranted, onBenefitRevoked } from './benefits'
import { onIssueUpdated } from './issues'
import { onOrganizationUpdated } from './organizations'

const ACTIONS: {
  [key: string]: (payload: any) => Promise<void>
} = {
  'issue.updated': onIssueUpdated,
  'organization.updated': onOrganizationUpdated,
  'benefit.granted': onBenefitGranted,
  'benefit.revoked': onBenefitRevoked,
}

const emitter = new EventEmitter()

export const useSSE = (
  platform?: string,
  orgName?: string,
  repoName?: string,
): EventEmitter => {
  let streamURL = getServerURL('/v1')
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
    connection.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      const handler = ACTIONS[data.key]
      if (handler) {
        await handler(data.payload)
      }
      emitter.emit(data.key, data.payload)
    }

    connection.onerror = (_event) => cleanup
    return cleanup
  }, [streamURL])

  return emitter
}
