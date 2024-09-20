'use client'

import {
  Organization,
  Product,
  ProductPrice,
  ProductPriceRecurringFixed,
  ProductPriceRecurringFree,
  SubscriptionRecurringInterval,
  UserSubscription,
} from '@polar-sh/sdk'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useProducts, useUpdateSubscription } from '@/hooks/queries'
import {
  CheckOutlined,
  ClearOutlined,
  ReceiptOutlined,
} from '@mui/icons-material'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { useCallback, useMemo, useState } from 'react'
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
      className="flex justify-between"
      onSelect={onSelect}
    >
      <div>{product.name}</div>
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
  const products = useProducts(organization.id, { isRecurring: true })
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
    } catch (err) {}
  }, [
    updateSubscription,
    selectedPrice,
    subscription,
    onUserSubscriptionUpdate,
    hide,
  ])

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Change Plan</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <h3 className="font-bold">Current Plan</h3>
        <List>
          <ProductPriceListItem
            product={subscription.product}
            price={currentPrice}
            selected
          />
        </List>
        <h3 className="font-bold">Available Plans</h3>
        <List>
          {products.data?.items.map((product) => (
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
        <ul className=" space-y-2 text-sm [&>li]:flex [&>li]:space-x-2 [&li]:items-center">
          {addedBenefits.length > 0 && (
            <li>
              <div>
                <CheckOutlined className="text-sm" />
              </div>
              <div>
                You&apos;ll get access to the following benefits:{' '}
                {addedBenefits.map(({ description }) => description).join(', ')}
              </div>
            </li>
          )}
          {removedBenefits.length > 0 && (
            <li>
              <div>
                <ClearOutlined className="text-sm" />
              </div>
              <div>
                You&apos;ll lose access to the following benefits:{' '}
                {removedBenefits
                  .map(({ description }) => description)
                  .join(', ')}
              </div>
            </li>
          )}
          {selectedPrice && (
            <li>
              <div>
                <ReceiptOutlined className="text-sm" />
              </div>
              <div>
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
              </div>
            </li>
          )}
        </ul>
        <Button
          disabled={!selectedPrice}
          loading={updateSubscription.isPending}
          onClick={onConfirm}
        >
          Change Plan
        </Button>
      </div>
    </div>
  )
}

export default ChangePlanModal
