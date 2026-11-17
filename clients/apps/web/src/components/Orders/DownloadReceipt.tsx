'use client'

import { useOrganizationSSE } from '@/hooks/sse'
import { api } from '@/utils/client'
import type { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import type EventEmitter from 'eventemitter3'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { toast } from '@/components/Toast/use-toast'
import { useCustomerPortalContext } from '../CustomerPortal/CustomerPortalProvider'
import { buttonVariants } from '@polar-sh/orbit/ui/button'

type Variant = NonNullable<Parameters<typeof buttonVariants>[0]>['variant']

export type DownloadReceiptHandle = {
  download: () => void
}

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
  variant,
  headless = false,
  receiptRef,
}: {
  order: schemas['Order'] | schemas['CustomerOrder']
  api: Client
  eventEmitter: EventEmitter
  receiptURL:
    | '/v1/orders/{id}/receipt'
    | '/v1/customer-portal/orders/{id}/receipt'
  className?: string
  variant?: Variant
  /** Render no button of its own; it is driven through `receiptRef`, e.g. from a menu. */
  headless?: boolean
  receiptRef?: RefObject<DownloadReceiptHandle | null>
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

  // with no button to turn into "Try again", a headless failure is reported as a toast
  const fail = useCallback(() => {
    if (headless) {
      toast({
        title: 'Could not download the receipt',
        description: 'Please try again, or contact support@polar.sh.',
      })
      return
    }
    setFailed(true)
  }, [headless])

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
        fail()
        return
      }

      const arrived = await waitForReceipt(
        eventEmitter,
        order.id,
        RENDER_TIMEOUT_MS,
      )
      if (!arrived) {
        fail()
        return
      }

      const ready = await fetchReceiptUrl()
      if ('url' in ready) {
        openInNewTab(ready.url)
      } else {
        fail()
      }
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [fetchReceiptUrl, eventEmitter, order.id, fail])

  useEffect(() => {
    if (!receiptRef) return
    receiptRef.current = { download: onDownload }
    return () => {
      receiptRef.current = null
    }
  }, [receiptRef, onDownload])

  if (headless) return null

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
      variant={variant}
    >
      Download receipt
    </Button>
  )
}

export const DownloadReceiptDashboard = ({
  organization,
  order,
  className,
  variant,
  headless,
  receiptRef,
}: {
  organization: schemas['Organization']
  order: schemas['Order']
  className?: string
  variant?: Variant
  headless?: boolean
  receiptRef?: RefObject<DownloadReceiptHandle | null>
}) => {
  const eventEmitter = useOrganizationSSE(organization.id)
  return (
    <DownloadReceipt
      order={order}
      api={api}
      eventEmitter={eventEmitter}
      receiptURL="/v1/orders/{id}/receipt"
      className={className}
      variant={variant}
      headless={headless}
      receiptRef={receiptRef}
    />
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
