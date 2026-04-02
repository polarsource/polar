import { getServerURL } from '@/utils/api'
import { EventSourcePlus } from 'event-source-plus'
import EventEmitter from 'eventemitter3'
import { useEffect } from 'react'
import { onOrganizationUpdated } from './organizations'

const ACTIONS = {
  'organization.updated': onOrganizationUpdated,
} as const

const isSupportedKey = (key: unknown): key is keyof typeof ACTIONS => {
  if (typeof key !== 'string') {
    return false
  }

  return typeof ACTIONS[key as keyof typeof ACTIONS] !== 'undefined'
}

const emitter = new EventEmitter()

const useSSE = (streamURL: string, token?: string): EventEmitter => {
  useEffect(() => {
    if (!token) {
      return
    }

    const eventSource = new EventSourcePlus(streamURL, {
      credentials: 'include',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })

    const controller = eventSource.listen({
      onMessage: async (message) => {
        const data = JSON.parse(message.data)

        // Server-initiated reconnect — EventSourcePlus handles the actual reconnection
        if (data.type === 'reconnect') return

        const key = data.key

        if (typeof key === 'string' && isSupportedKey(key)) {
          const handler = ACTIONS[key]
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
  useSSE(getServerURL(`/v1/checkouts/client/${clientSecret}/stream`))
export const useCustomerSSE = (customerSessionToken?: string) =>
  useSSE(
    getServerURL('/v1/customer-portal/customers/stream'),
    customerSessionToken,
  )
