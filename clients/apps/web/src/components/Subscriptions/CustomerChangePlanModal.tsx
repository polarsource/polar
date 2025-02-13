'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useCustomerUpdateSubscription } from '@/hooks/queries'
import { hasLegacyRecurringPrices } from '@/utils/product'
import { Client, schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { resolveBenefitIcon } from '../Benefit/utils'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { toast } from '../Toast/use-toast'
import { getErrorRedirect } from '../Toast/utils'

const ProductPriceListItem = ({
  product,
  price,
  selected,
  onSelect,
}: {
  product: schemas['ProductStorefront']
  price: schemas['ProductPrice']
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
      <ProductPriceLabel product={product} price={price} />
    </ListItem>
  )
}

const CustomerChangePlanModal = ({
  api,
  organization,
  products: _products,
  subscription,
  hide,
  onUserSubscriptionUpdate,
}: {
  api: Client
  organization: schemas['Organization']
  products: schemas['CustomerProduct'][]
  subscription: schemas['CustomerSubscription']
  hide: () => void
  onUserSubscriptionUpdate: (
    subscription: schemas['CustomerSubscription'],
  ) => void
}) => {
  const router = useRouter()
  const products = useMemo(
    () =>
      _products.filter((p) => p.is_recurring && !hasLegacyRecurringPrices(p)),
    [_products],
  )

  const currentPrice = subscription.price
  const currentInterval = subscription.recurring_interval

  const [selectedProduct, setSelectedProduct] = useState<
    schemas['ProductStorefront'] | null
  >(null)
  const selectedPrice: schemas['ProductPrice'] | null = useMemo(
    () => (selectedProduct ? selectedProduct.prices[0] : null),
    [selectedProduct],
  )

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
          currentPrice.price_amount / (currentInterval === 'year' ? 12 : 1) >
          selectedPrice.price_amount / (currentInterval === 'year' ? 12 : 1)
        )
      }
    }
  }, [selectedPrice, currentPrice, currentInterval])

  const prorationBehavior = useMemo(
    () => organization.subscription_settings.proration_behavior,
    [organization],
  )
  const invoicingMessage = useMemo(() => {
    if (!selectedPrice) return null

    if (prorationBehavior === 'invoice') {
      if (isDowngrade) {
        return 'An invoice will be issued with a credit for the unused time this month.'
      } else {
        return 'An invoice will be issued with a proration for the current month.'
      }
    } else {
      if (isDowngrade) {
        if (selectedPrice.amount_type === 'free') {
          return 'A credit invoice will be issued for the unused time this month.'
        } else if (selectedPrice.amount_type === 'fixed') {
          return `On your next invoice, you'll be billed ${formatCurrencyAndAmount(
            selectedPrice.price_amount,
            selectedPrice.price_currency,
            0,
          )}, minus a credit of what we already billed for the current month.`
        }
      } else {
        if (selectedPrice.amount_type === 'free') {
          return 'An invoice will be issued with a proration for the current month.'
        } else if (selectedPrice.amount_type === 'fixed') {
          return `On your next invoice, you'll be billed ${formatCurrencyAndAmount(
            selectedPrice.price_amount,
            selectedPrice.price_currency,
            0,
          )}, plus a proration for the current month.`
        }
      }
    }
  }, [selectedPrice, prorationBehavior, isDowngrade])

  const updateSubscription = useCustomerUpdateSubscription(api)
  const onConfirm = useCallback(async () => {
    if (!selectedProduct) return
    const { data, response } = await updateSubscription.mutateAsync({
      id: subscription.id,
      body: {
        product_id: selectedProduct.id,
      },
    })
    if (response.status === 400) {
      const body = await response.json()
      if (body.error === 'SubscriptionNotActiveOnStripe') {
        router.push(
          getErrorRedirect(
            `/${organization.slug}/products/${subscription.product_id}`,
            'Subscription Update Failed',
            'Subscription is not active on Stripe',
          ),
        )
      } else if (body.error === 'MissingPaymentMethod') {
        const { url } = await unwrap(
          api.POST('/v1/checkouts/client/', {
            body: {
              product_id: selectedProduct.id,
              subscription_id: subscription.id,
            },
          }),
        )
        router.push(url)
      }
    } else if (data) {
      toast({
        title: 'Subscription Updated',
        description: `Subscription was updated successfully`,
      })
      onUserSubscriptionUpdate(data)
      hide()
    }
  }, [
    updateSubscription,
    selectedProduct,
    organization,
    subscription,
    onUserSubscriptionUpdate,
    hide,
    router,
    api,
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
          {products
            .filter((product) => product.id !== subscription.product_id)
            .map((product) => (
              <ProductPriceListItem
                key={product.id}
                product={product}
                price={product.prices[0]}
                selected={selectedProduct?.id === product.id}
                onSelect={() => setSelectedProduct(product)}
              />
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
                      {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
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
                      {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
                    </span>
                    <span className="ml-2 text-sm">{benefit.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {invoicingMessage && (
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {invoicingMessage}
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

export default CustomerChangePlanModal
