'use client'

import { useClearPendingSubscriptionUpdate } from '@/hooks/queries/subscriptions'
import { useProduct } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ConfirmModal } from '../Modal/ConfirmModal'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { useState, useContext } from 'react'
import { DetailRow } from '../Shared/DetailRow'

export const ScheduledUpdateSection = ({
  pendingUpdate,
  subscription,
}: {
  pendingUpdate: schemas['PendingSubscriptionUpdate']
  subscription: schemas['Subscription']
}) => {
  const { organization } = useContext(OrganizationContext)
  const { data: newProduct } = useProduct(pendingUpdate.product_id ?? undefined)
  const clearPendingUpdate = useClearPendingSubscriptionUpdate(subscription.id)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  return (
    <div className="mt-2 flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between gap-x-2">
        <h3 className="text-lg">Scheduled Update</h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowConfirmModal(true)}
          loading={clearPendingUpdate.isPending}
        >
          Cancel scheduled change
        </Button>
      </div>
      <div className="flex flex-col gap-y-2">
        {newProduct && (
          <DetailRow
            label="New Product"
            value={
              <Link
                href={`/dashboard/${organization.slug}/products/${newProduct.id}`}
                className="flex items-center gap-1"
              >
                {newProduct.name}
                <ArrowOutwardOutlined
                  fontSize="inherit"
                  className="opacity-50"
                />
              </Link>
            }
          />
        )}
        {pendingUpdate.seats !== null && (
          <DetailRow
            label="New Seats"
            value={`${subscription.seats ?? 0} -> ${pendingUpdate.seats}`}
          />
        )}
        <DetailRow
          label="Will be applied on"
          value={<FormattedDateTime datetime={pendingUpdate.applies_at} />}
        />
      </div>

      <ConfirmModal
        isShown={showConfirmModal}
        hide={() => setShowConfirmModal(false)}
        title="Cancel scheduled change"
        description="The customer's subscription will remain unchanged on the next billing cycle. Are you sure you want to cancel this pending update?"
        onConfirm={() => clearPendingUpdate.mutateAsync()}
      />
    </div>
  )
}
