import { getServerURL } from '@/utils/api'
import { EventSourcePlus } from 'event-source-plus'
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

const useSSE = (streamURL: string, token?: string): EventEmitter => {
  useEffect(() => {
    const eventSource = new EventSourcePlus(streamURL, {
      credentials: 'include',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })

    const controller = eventSource.listen({
      onMessage: async (message) => {
        const data = JSON.parse(message.data)
        const handler = ACTIONS[data.key]
        if (handler) {
          await handler(data.payload)
        }
        emitter.emit(data.key, data.payload)
      },
    })

    const cleanup = () => {
      controller.abort()
    }

    return cleanup
  }, [streamURL, token])

  return emitter
}

export const useUserSSE = () => useSSE(getServerURL('/v1/stream/user'))
export const useOrganizationSSE = (organizationId: string) =>
  useSSE(getServerURL(`/v1/stream/organizations/${organizationId}`))
export const useCheckoutClientSSE = (clientSecret: string) =>
  useSSE(getServerURL(`/v1/checkouts/custom/client/${clientSecret}/stream`))
export const useCustomerSSE = (customerSessionToken?: string) =>
  useSSE(
    getServerURL('/v1/customer-portal/customers/stream'),
    customerSessionToken,
  )
