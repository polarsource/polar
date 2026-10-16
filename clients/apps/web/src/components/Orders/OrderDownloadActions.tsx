'use client'

import type { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
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
      <Box flexDirection="column" rowGap="s">
        {hasReceipt && <DownloadReceiptPortal order={order} />}
        <DownloadInvoicePortal
          customerSessionToken={customerSessionToken}
          order={order}
          onInvoiceGenerated={() => {}}
          variant={hasReceipt ? 'secondary' : undefined}
        />
      </Box>
    )
  }

  return (
    <Box columnGap="s" rowGap="s" flexWrap="wrap" justifyContent="end">
      {hasReceipt ? (
        <>
          <DownloadInvoicePortal
            customerSessionToken={customerSessionToken}
            order={order}
            onInvoiceGenerated={() => {}}
            variant="secondary"
          />
          <DownloadReceiptPortal order={order} className="w-auto" />
        </>
      ) : (
        <DownloadInvoicePortal
          customerSessionToken={customerSessionToken}
          order={order}
          onInvoiceGenerated={() => {}}
          className="w-auto"
        />
      )}
    </Box>
  )
}
