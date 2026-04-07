'use client'

import { useSubscriptions } from '@/hooks/queries'
import { Modal } from '@/components/Modal'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { type CancellationReason, REASON_LABELS } from './constants'

interface CancellationReasonModalProps {
  onOpenChange: (open: boolean) => void
  reason: CancellationReason
  organizationId: string
  startDate: Date
  endDate: Date
  productId?: string[]
  totalCount?: number
}

export function CancellationReasonModal({
  onOpenChange,
  reason,
  organizationId,
  startDate,
  endDate,
  productId,
  totalCount = 0,
}: CancellationReasonModalProps) {
  const [page, setPage] = useState(1)

  const { data, isPending } = useSubscriptions(organizationId, {
    customer_cancellation_reason: [reason],
    canceled_at_after: startDate.toISOString(),
    canceled_at_before: endDate.toISOString(),
    ...(productId && productId.length > 0 ? { product_id: productId } : {}),
    page,
    limit: 20,
  })

  const items = data?.items ?? []
  const resolvedTotalCount = data?.pagination?.total_count ?? totalCount
  const maxPage = data?.pagination?.max_page ?? 1

  return (
    <Modal
      title={
        <>
          {resolvedTotalCount} &ldquo;{REASON_LABELS[reason]}&rdquo;
          cancellation
          {resolvedTotalCount !== 1 ? 's' : ''} between{' '}
          <FormattedInterval startDatetime={startDate} endDatetime={endDate} />
        </>
      }
      isShown={true}
      hide={() => onOpenChange(false)}
      className="lg:w-xl"
      modalContent={
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            {isPending && (
              <div className="flex flex-col gap-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="dark:bg-polar-700 h-14 animate-pulse rounded-lg bg-gray-100"
                  />
                ))}
              </div>
            )}

            {resolvedTotalCount === 0 ? (
              <div className="dark:text-polar-400 text-center text-sm text-gray-500">
                No &ldquo;{REASON_LABELS[reason]}&rdquo; cancellations
              </div>
            ) : (
              items.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                  showComment={reason === 'other'}
                />
              ))
            )}
          </div>

          {maxPage > 1 && (
            <div className="flex items-center justify-between">
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
        </div>
      }
    />
  )
}

function SubscriptionRow({
  subscription,
  showComment,
}: {
  subscription: schemas['Subscription']
  showComment: boolean
}) {
  const { organization } = useParams<{ organization: string }>()

  return (
    <div className="dark:border-polar-700 flex flex-col gap-1 rounded-lg border border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <Link
            href={`/dashboard/${organization}/customers/${subscription.customer.id}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {subscription.customer.name || subscription.customer.email}
          </Link>
          {subscription.customer.name && (
            <Link
              href={`/dashboard/${organization}/customers/${subscription.customer.id}`}
              className="dark:text-polar-400 truncate text-xs text-gray-500 hover:underline"
            >
              {subscription.customer.email}
            </Link>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Link
            href={`/dashboard/${organization}/sales/subscriptions/${subscription.id}`}
            className="dark:text-polar-400 text-xs text-gray-500 hover:underline"
          >
            {subscription.product.name}
          </Link>
          {subscription.canceled_at && (
            <span className="dark:text-polar-400 text-xs text-gray-500">
              <FormattedDateTime datetime={subscription.canceled_at} />
            </span>
          )}
        </div>
      </div>
      {showComment && subscription.customer_cancellation_comment && (
        <div className="dark:bg-polar-800 dark:text-polar-400 mt-1 rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
          {subscription.customer_cancellation_comment}
        </div>
      )}
    </div>
  )
}
