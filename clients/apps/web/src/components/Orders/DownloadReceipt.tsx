'use client'

import type { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import type EventEmitter from 'eventemitter3'
import { useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useCustomerPortalContext } from '../CustomerPortal/CustomerPortalProvider'

const RECEIPT_GENERATED_EVENT = 'order.receipt_generated'
const RENDER_TIMEOUT_MS = 30_000

const openInNewTab = (url: string) => {
  const newWindow = window.open(url, '_blank')
  if (!newWindow) {
    window.location.href = url
  }
}

const waitForReceipt = (
  eventEmitter: EventEmitter,
  orderId: string,
  timeoutMs: number,
) =>
  new Promise<boolean>((resolve) => {
    const listener = ({ order_id }: { order_id: string }) => {
      if (order_id !== orderId) return
      cleanup()
      resolve(true)
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve(false)
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      eventEmitter.off(RECEIPT_GENERATED_EVENT, listener)
    }
    eventEmitter.on(RECEIPT_GENERATED_EVENT, listener)
  })

const DownloadReceipt = ({
  order,
  api,
  eventEmitter,
  receiptURL,
  className,
}: {
  order: schemas['Order'] | schemas['CustomerOrder']
  api: Client
  eventEmitter: EventEmitter
  receiptURL:
    | '/v1/orders/{id}/receipt'
    | '/v1/customer-portal/orders/{id}/receipt'
  className?: string
}) => {
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const inFlightRef = useRef(false)

  const fetchReceiptUrl = useCallback(async (): Promise<
    { url: string } | { pending: true } | { failed: true }
  > => {
    const response = await api.GET(receiptURL, {
      params: { path: { id: order.id } },
    })
    if (response.data?.url) {
      return { url: response.data.url }
    }
    // 202 has no body, openapi-fetch returns data as undefined.
    if (response.response.status === 202) {
      return { pending: true }
    }
    return { failed: true }
  }, [api, order.id, receiptURL])

  const onDownload = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setFailed(false)

    try {
      const initial = await fetchReceiptUrl()
      if ('url' in initial) {
        openInNewTab(initial.url)
        return
      }
      if ('failed' in initial) {
        setFailed(true)
        return
      }

      const arrived = await waitForReceipt(
        eventEmitter,
        order.id,
        RENDER_TIMEOUT_MS,
      )
      if (!arrived) {
        setFailed(true)
        return
      }

      const ready = await fetchReceiptUrl()
      if ('url' in ready) {
        openInNewTab(ready.url)
      } else {
        setFailed(true)
      }
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [fetchReceiptUrl, eventEmitter, order.id])

  if (failed) {
    return (
      <div className={twMerge('flex flex-col gap-2 lg:flex-row', className)}>
        <Button
          type="button"
          variant="secondary"
          onClick={onDownload}
          className="w-full"
        >
          Try again
        </Button>
        <Button type="button" asChild className="w-full">
          <a href="mailto:support@polar.sh">Contact support</a>
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      onClick={onDownload}
      loading={loading}
      disabled={loading}
      className={twMerge('w-full', className)}
    >
      Download Receipt
    </Button>
  )
}

export const DownloadReceiptPortal = ({
  order,
  className,
}: {
  order: schemas['CustomerOrder']
  className?: string
}) => {
  const { client: api, customerSSE } = useCustomerPortalContext()
  return (
    <DownloadReceipt
      order={order}
      api={api}
      eventEmitter={customerSSE}
      receiptURL="/v1/customer-portal/orders/{id}/receipt"
      className={className}
    />
  )
}
