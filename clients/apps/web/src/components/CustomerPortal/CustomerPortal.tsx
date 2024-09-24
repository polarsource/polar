'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import AmountLabel from '@/components/Shared/AmountLabel'
import { useOrganization } from '@/hooks/queries'
import { Organization, UserOrder } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

export interface CustomerPortalProps {
  organization?: Organization
  orders: UserOrder[]
}

export const CustomerPortal = ({
  organization,
  orders,
}: CustomerPortalProps) => {
  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
      <div className="flex w-full max-w-2xl flex-col gap-y-12">
        {organization && (
          <div className="flex flex-row items-center gap-x-4">
            <Avatar
              className="h-12 w-12"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <h3 className="text-xl">{organization.name}</h3>
          </div>
        )}
        <div className="flex flex-row items-center justify-between">
          <h3 className="text-3xl">Customer Portal</h3>
        </div>
        {orders.map((order) => (
          <Link
            key={order.id}
            className="flex w-full flex-row items-center justify-between"
            href={`/purchases/products/${order.id}`}
          >
            <OrderItem key={order.id} order={order} />
          </Link>
        ))}
      </div>
    </ShadowBox>
  )
}

const OrderItem = ({ order }: { order: UserOrder }) => {
  const { data: organization } = useOrganization(order.product.organization_id)

  return (
    <ShadowBox className="dark:bg-polar-950 flex w-full flex-col gap-y-6 bg-gray-100">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-row items-center gap-x-4">
          {order.product.medias.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="dark:bg-polar-950 h-16 w-16 rounded-2xl bg-gray-100 object-cover"
              alt={order.product.medias[0].name}
              width={600}
              height={600}
              src={order.product.medias[0].public_url}
            />
          ) : (
            <div className="dark:from-polar-900 dark:via-polar-800 dark:to-polar-900 flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-gradient-to-tr from-white via-blue-50 to-white">
              <div className="flex flex-col items-center justify-center text-4xl text-blue-500 dark:text-white">
                <LogoIcon className="dark:text-polar-600 h-12 w-12 text-white/50" />
              </div>
            </div>
          )}
          <div className="flex flex-col">
            <h3 className="truncate text-2xl">{order.product.name}</h3>
            {organization && (
              <p className="dark:text-polar-500 text-sm text-gray-500">
                {organization.name}
              </p>
            )}
          </div>
        </div>
        <Link href={`/purchases/products/${order.id}`}>
          <Button size="sm">View Purchase</Button>
        </Link>
      </div>
      <div className="dark:divide-polar-700 flex flex-col divide-y divide-gray-100 text-sm">
        <div className="flex flex-row items-center justify-between py-2">
          <span>Amount</span>
          {order.amount && order.currency ? (
            <AmountLabel amount={order.amount} currency={order.currency} />
          ) : (
            'Free'
          )}
        </div>
        {order.created_at && (
          <div className="flex flex-row items-center justify-between py-3">
            <span>Purchase Date</span>
            <span>
              {new Date(order.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
        {order.product.benefits.length > 0 && (
          <div className="flex flex-row items-center justify-between py-3">
            <span>Benefits</span>
            <span>
              <Link href={`/purchases/products/${order.id}`}>
                <Button size="sm" variant="secondary">
                  View Benefits
                </Button>
              </Link>
            </span>
          </div>
        )}
      </div>
    </ShadowBox>
  )
}
