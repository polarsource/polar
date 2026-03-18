'use client'

import { useSubscriptions } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@polar-sh/ui/components/ui/dialog'
import { useState } from 'react'
import {
  type CancellationReason,
  REASON_COLORS,
  REASON_LABELS,
} from './constants'

interface CancellationReasonModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  reason: CancellationReason
  organizationId: string
  startDate: Date
  endDate: Date
  productId?: string[]
}

export function CancellationReasonModal({
  isOpen,
  onOpenChange,
  reason,
  organizationId,
  startDate,
  endDate,
  productId,
}: CancellationReasonModalProps) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useSubscriptions(organizationId, {
    customer_cancellation_reason: [reason],
    canceled_at_after: startDate.toISOString(),
    canceled_at_before: endDate.toISOString(),
    ...(productId && productId.length > 0 ? { product_id: productId } : {}),
    page,
    limit: 20,
  })

  const items = data?.items ?? []
  const totalCount = data?.pagination?.total_count ?? 0
  const maxPage = data?.pagination?.max_page ?? 1

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: REASON_COLORS[reason] }}
            />
            {REASON_LABELS[reason]}
          </DialogTitle>
          <DialogDescription>
            {totalCount} cancellation{totalCount !== 1 ? 's' : ''} in selected
            period
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col gap-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="dark:bg-polar-700 h-14 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="dark:text-polar-400 py-8 text-center text-sm text-gray-500">
              No cancellations found for this reason.
            </div>
          )}

          {items.map((subscription) => (
            <SubscriptionRow
              key={subscription.id}
              subscription={subscription}
              showComment={reason === 'other'}
            />
          ))}
        </div>

        {maxPage > 1 && (
          <div className="dark:border-polar-700 flex items-center justify-between border-t pt-3">
            <span className="dark:text-polar-400 text-xs text-gray-500">
              Page {page} of {maxPage}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= maxPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SubscriptionRow({
  subscription,
  showComment,
}: {
  subscription: schemas['Subscription']
  showComment: boolean
}) {
  return (
    <div className="dark:border-polar-700 flex flex-col gap-1 rounded-lg border border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <span className="truncate text-sm font-medium">
            {subscription.customer.name || subscription.customer.email}
          </span>
          {subscription.customer.name && (
            <span className="dark:text-polar-400 truncate text-xs text-gray-500">
              {subscription.customer.email}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="dark:text-polar-400 text-xs text-gray-500">
            {subscription.product.name}
          </span>
          {subscription.canceled_at && (
            <span className="dark:text-polar-400 text-xs text-gray-500">
              <FormattedDateTime datetime={subscription.canceled_at} />
            </span>
          )}
        </div>
      </div>
      {showComment && subscription.customer_cancellation_comment && (
        <div className="dark:bg-polar-800 dark:text-polar-400 mt-1 rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-600 italic">
          &ldquo;{subscription.customer_cancellation_comment}&rdquo;
        </div>
      )}
    </div>
  )
}
