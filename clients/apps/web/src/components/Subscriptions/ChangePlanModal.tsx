'use client'

import {
  Organization,
  Product,
  ProductPrice,
  ProductPriceRecurringFixed,
  ProductPriceRecurringFree,
  ResponseError,
  SubscriptionRecurringInterval,
  UserSubscription,
} from '@polar-sh/sdk'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useStorefront, useUpdateSubscription } from '@/hooks/queries'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { useCallback, useMemo, useState } from 'react'
import { resolveBenefitIcon } from '../Benefit/utils'
import ProductPriceLabel from '../Products/ProductPriceLabel'

const ProductPriceListItem = ({
  product,
  price,
  selected,
  onSelect,
}: {
  product: Product
  price: ProductPrice
  selected: boolean
  onSelect?: () => void
}) => {
  return (
    <ListItem
      selected={selected}
      className="flex flex-row items-center justify-between text-sm"
      onSelect={onSelect}
      size="small"
    >
      <h3 className="font-medium">{product.name}</h3>
      <ProductPriceLabel price={price} />
    </ListItem>
  )
}

const ChangePlanModal = ({
  organization,
  subscription,
  hide,
  onUserSubscriptionUpdate,
}: {
  organization: Organization
  subscription: UserSubscription
  hide: () => void
  onUserSubscriptionUpdate: (subscription: UserSubscription) => void
}) => {
  const router = useRouter()
  const { data: storefront } = useStorefront(organization.slug)
  const products = storefront?.products.filter(
    ({ is_recurring }) => is_recurring,
  )

  const currentPrice = subscription.price as
    | ProductPriceRecurringFixed
    | ProductPriceRecurringFree
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedPrice, setSelectedPrice] = useState<
    ProductPriceRecurringFixed | ProductPriceRecurringFree | null
  >(null)

  const addedBenefits = useMemo(() => {
    if (!selectedProduct) return []
    return selectedProduct.benefits.filter(
      (benefit) =>
        !subscription.product.benefits.some((b) => b.id === benefit.id),
    )
  }, [selectedProduct, subscription])
  const removedBenefits = useMemo(() => {
    if (!selectedProduct) return []
    return subscription.product.benefits.filter(
      (benefit) => !selectedProduct.benefits.some((b) => b.id === benefit.id),
    )
  }, [selectedProduct, subscription])

  const isDowngrade = useMemo(() => {
    if (!selectedPrice) return false
    if (
      selectedPrice.amount_type === 'free' &&
      currentPrice.amount_type !== 'free'
    ) {
      return true
    }
    if (selectedPrice.amount_type === 'fixed') {
      if (currentPrice.amount_type === 'free') {
        return false
      } else if (currentPrice.amount_type === 'fixed') {
        return (
          currentPrice.price_amount /
            (currentPrice.recurring_interval ===
            SubscriptionRecurringInterval.YEAR
              ? 12
              : 1) >
          selectedPrice.price_amount /
            (selectedPrice.recurring_interval ===
            SubscriptionRecurringInterval.YEAR
              ? 12
              : 1)
        )
      }
    }
  }, [selectedPrice, currentPrice])

  const updateSubscription = useUpdateSubscription()
  const onConfirm = useCallback(async () => {
    if (!selectedPrice) return
    try {
      const updatedUserSubscription = await updateSubscription.mutateAsync({
        id: subscription.id,
        body: {
          product_price_id: selectedPrice.id,
        },
      })
      onUserSubscriptionUpdate(updatedUserSubscription)
      hide()
    } catch (err) {
      if (err instanceof ResponseError) {
        const status = err.response.status
        if (status === 400) {
          const body = await err.response.json()
          if (body.error === 'SubscriptionNotActiveOnStripe') {
            router.push(
              `/api/checkout?price=${selectedPrice.id}&subscription=${subscription.id}`,
            )
          }
        }
      }
    }
  }, [
    updateSubscription,
    selectedPrice,
    subscription,
    onUserSubscriptionUpdate,
    hide,
    router,
  ])

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Change Plan</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <h3 className="font-medium">Current Plan</h3>
        <List size="small">
          <ProductPriceListItem
            product={subscription.product}
            price={currentPrice}
            selected
          />
        </List>
        <h3 className="font-medium">Available Plans</h3>
        <List size="small">
          {products?.map((product) => (
            <>
              {product.prices
                .filter((price) => price.id !== subscription.price_id)
                .map((price) => (
                  <ProductPriceListItem
                    key={price.id}
                    product={product}
                    price={price}
                    selected={selectedPrice?.id === price.id}
                    onSelect={() => {
                      setSelectedProduct(product)
                      setSelectedPrice(
                        price as
                          | ProductPriceRecurringFixed
                          | ProductPriceRecurringFree,
                      )
                    }}
                  />
                ))}
            </>
          ))}
        </List>
        <div className="flex flex-col gap-y-6">
          {addedBenefits.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <h3 className="text-sm font-medium text-green-400">
                You&apos;ll get access to the following benefits
              </h3>
              <div className="flex flex-col gap-y-2">
                {addedBenefits.map((benefit) => (
                  <div key={benefit.id} className="flex flex-row align-middle">
                    <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-500 dark:text-white">
                      {resolveBenefitIcon(benefit, 'inherit', 'h-3 w-3')}
                    </span>
                    <span className="ml-2 text-sm">{benefit.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {removedBenefits.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <h3 className="text-sm font-medium text-red-400">
                You&apos;ll will loose access to the following benefits
              </h3>
              <div className="flex flex-col gap-y-2">
                {removedBenefits.map((benefit) => (
                  <div key={benefit.id} className="flex flex-row align-middle">
                    <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-500 dark:text-white">
                      {resolveBenefitIcon(benefit, 'inherit', 'h-3 w-3')}
                    </span>
                    <span className="ml-2 text-sm">{benefit.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedPrice && (
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {isDowngrade
                ? selectedPrice.amount_type === 'free'
                  ? `We'll issue a credit invoice for the unused time this month.`
                  : `On your next invoice, you'll be billed ${formatCurrencyAndAmount(
                      selectedPrice.price_amount,
                      selectedPrice.price_currency,
                      0,
                    )}, minus a credit of what we already billed for the current month.`
                : selectedPrice.amount_type === 'free'
                  ? ''
                  : `On your next invoice, you'll be billed ${formatCurrencyAndAmount(
                      selectedPrice.price_amount,
                      selectedPrice.price_currency,
                      0,
                    )}, plus a proration for the current month.`}
            </p>
          )}
        </div>
        <Button
          disabled={!selectedPrice}
          loading={updateSubscription.isPending}
          onClick={onConfirm}
          size="lg"
        >
          Change Plan
        </Button>
      </div>
    </div>
  )
}

export default ChangePlanModal
