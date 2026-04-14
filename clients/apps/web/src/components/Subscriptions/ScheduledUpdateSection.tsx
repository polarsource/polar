'use client'

import { useProduct } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { Clock } from 'lucide-react'
import Link from 'next/link'
import { useContext } from 'react'
import { DetailRow } from '../Shared/DetailRow'

export const ScheduledUpdateSection = ({
  pendingUpdate,
  subscription,
}: {
  pendingUpdate: schemas['PendingSubscriptionUpdate']
  subscription: schemas['Subscription']
}) => {
  const { organization } = useContext(OrganizationContext)
  const { data: newProduct } = useProduct(
    pendingUpdate.product_id ?? undefined,
  )

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center gap-x-2">
        <h3 className="text-lg">Scheduled Update</h3>
        <Pill color="yellow">
          <Clock className="size-3" />
          <span>Pending</span>
        </Pill>
      </div>
      <div className="flex flex-col gap-y-2">
        <DetailRow
          label="Will be applied on"
          value={<FormattedDateTime datetime={pendingUpdate.applies_at} />}
        />
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
      </div>
    </div>
  )
}
