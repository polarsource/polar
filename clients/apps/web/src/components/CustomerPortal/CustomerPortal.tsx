import { useOrganization, useUserOrders } from '@/hooks/queries'
import { Organization, ProductPriceType, UserOrder } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Separator } from 'polarkit/components/ui/separator'
import { useCallback, useContext } from 'react'
import LogoIcon from '../Brand/LogoIcon'
import { PurchasesQueryParametersContext } from '../Purchases/PurchasesQueryParametersContext'
import AmountLabel from '../Shared/AmountLabel'

export interface CustomerPortalProps {
  organization?: Organization
}

export const CustomerPortal = ({ organization }: CustomerPortalProps) => {
  const [purchaseParameters, setPurchaseParameters] = useContext(
    PurchasesQueryParametersContext,
  )

  const onPageChange = useCallback(
    (page: number) => {
      setPurchaseParameters((prev) => ({
        ...prev,
        page,
      }))
    },
    [setPurchaseParameters],
  )

  const { data: subscriptionOrders } = useUserOrders({
    productPriceType: ProductPriceType.RECURRING,
    query: purchaseParameters.query,
    limit: purchaseParameters.limit,
    page: purchaseParameters.page,
    organizationId: organization?.id,
  })

  const { data: oneTimeOrders } = useUserOrders({
    productPriceType: ProductPriceType.ONE_TIME,
    query: purchaseParameters.query,
    limit: purchaseParameters.limit,
    page: purchaseParameters.page,
    organizationId: organization?.id,
  })

  return (
    <div className="flex flex-col gap-y-8">
      {organization && (
        <Avatar name={organization.name} avatar_url={organization.avatar_url} />
      )}
      <div>
        <h1 className="text-3xl md:text-4xl">Customer Portal</h1>
      </div>
      <Separator />
      {(subscriptionOrders?.items.length ?? 0) > 0 && (
        <div className="flex flex-col gap-y-6">
          <h3 className="text-2xl">Subscriptions</h3>
          <div className="flex flex-col gap-y-4">
            {subscriptionOrders?.items.map((order) => (
              <OrderItem key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}
      {(oneTimeOrders?.items.length ?? 0) > 0 && (
        <div className="flex flex-col gap-y-6">
          <h3 className="text-2xl">Purchases</h3>
          <div className="flex flex-col gap-y-4">
            {oneTimeOrders?.items.map((order) => (
              <OrderItem key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const OrderItem = ({ order }: { order: UserOrder }) => {
  const { data: organization } = useOrganization(order.product.organization_id)

  if (!organization) {
    return null
  }

  return (
    <ShadowBox className="flex w-full flex-col gap-y-6">
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
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {organization.name}
            </p>
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
