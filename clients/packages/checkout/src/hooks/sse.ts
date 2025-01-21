import type { PolarCore } from '@polar-sh/sdk/core'
import { EventSourcePlus } from 'event-source-plus'
import EventEmitter from 'eventemitter3'
import { useEffect, useMemo } from 'react'

const useSSE = (streamURL: string, token?: string): EventEmitter => {
  const emitter = useMemo(() => new EventEmitter(), [])

  useEffect(() => {
    const eventSource = new EventSourcePlus(streamURL, {
      credentials: 'include',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })

    const controller = eventSource.listen({
      onMessage: async (message) => {
        const data = JSON.parse(message.data)
        emitter.emit(data.key, data.payload)
      },
    })

    const cleanup = () => {
      controller.abort()
    }

    return cleanup
  }, [emitter, streamURL, token])

  return emitter
}

export const useCheckoutClientSSE = (
  client: PolarCore,
  clientSecret: string,
) => {
  // @ts-ignore
  const baseURL = client._baseURL
  const url = `${baseURL}v1/checkouts/custom/client/${clientSecret}/stream`
  return useSSE(url)
}
