'use client'

import type { schemas } from '@polar-sh/client'
import { useIsMobile } from '@polar-sh/ui/hooks/use-mobile'
import { DownloadInvoicePortal } from './DownloadInvoice'
import { DownloadReceiptPortal } from './DownloadReceipt'

interface OrderDownloadActionsProps {
  order: schemas['CustomerOrder']
  customerSessionToken: string
}

export const OrderDownloadActions = ({
  order,
  customerSessionToken,
}: OrderDownloadActionsProps) => {
  const isMobile = useIsMobile()
  const hasReceipt = order.receipt_number != null

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        {hasReceipt && <DownloadReceiptPortal order={order} />}
        <DownloadInvoicePortal
          customerSessionToken={customerSessionToken}
          order={order}
          onInvoiceGenerated={() => {}}
          variant={hasReceipt ? 'secondary' : undefined}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {hasReceipt ? (
        <>
          <DownloadReceiptPortal order={order} className="w-auto" />
          <DownloadInvoicePortal
            customerSessionToken={customerSessionToken}
            order={order}
            onInvoiceGenerated={() => {}}
            variant="secondary"
          />
        </>
      ) : (
        <DownloadInvoicePortal
          customerSessionToken={customerSessionToken}
          order={order}
          onInvoiceGenerated={() => {}}
          className="w-auto"
        />
      )}
    </div>
  )
}
