'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import {
  useCustomerPaymentMethods,
  useCustomerUpdateSubscription,
} from '@/hooks/queries'
import { hasLegacyRecurringPrices } from '@/utils/product'
import { Client, schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { resolveBenefitIcon } from '../Benefit/utils'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { toast } from '../Toast/use-toast'
import { getErrorRedirect } from '../Toast/utils'

const ProductPriceListItem = ({
  product,
  selected,
  onSelect,
  themingPreset,
}: {
  product: schemas['ProductStorefront']
  selected: boolean
  onSelect?: () => void
  themingPreset: ThemingPresetProps
}) => {
  return (
    <ListItem
      selected={selected}
      className={twMerge(
        'flex flex-row items-center justify-between text-sm',
        themingPreset.polar.listItem,
      )}
      onSelect={onSelect}
      size="small"
    >
      <h3 className="font-medium">{product.name}</h3>
      <ProductPriceLabel product={product} />
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
  themingPreset,
}: {
  api: Client
  organization: schemas['Organization']
  products: schemas['CustomerProduct'][]
  subscription: schemas['CustomerSubscription']
  hide: () => void
  onUserSubscriptionUpdate: (
    subscription: schemas['CustomerSubscription'],
  ) => void
  themingPreset: ThemingPresetProps
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const settingsPath = `/${organization.slug}/portal/settings?${searchParams.toString()}`

  const products = useMemo(
    () =>
      _products.filter((p) => p.is_recurring && !hasLegacyRecurringPrices(p)),
    [_products],
  )

  const [selectedProduct, setSelectedProduct] = useState<
    schemas['ProductStorefront'] | null
  >(null)

  const paymentMethods = useCustomerPaymentMethods(api)

  const hasPaymentMethod = useMemo(() => {
    return paymentMethods.data?.items.length ?? 0 > 0
  }, [paymentMethods.data])

  const needToAddPaymentMethod = useMemo(() => {
    if (!selectedProduct) return false

    const selectedPlanIsFree = selectedProduct?.prices.some(
      (p) => p.amount_type === 'free',
    )

    if (selectedPlanIsFree) return false

    return !hasPaymentMethod
  }, [selectedProduct, hasPaymentMethod])

  const canChangePlan = useMemo(() => {
    if (!selectedProduct) return false
    const isSamePlan = selectedProduct?.id === subscription.product_id
    if (isSamePlan) return false

    const selectedPlanIsFree = selectedProduct?.prices.some(
      (p) => p.amount_type === 'free',
    )

    if (selectedPlanIsFree) return true

    return hasPaymentMethod
  }, [hasPaymentMethod, selectedProduct, subscription])

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

  const prorationBehavior = useMemo(
    () => organization.subscription_settings.proration_behavior,
    [organization],
  )
  const invoicingMessage = useMemo(() => {
    if (!selectedProduct) return null

    if (prorationBehavior === 'invoice') {
      return 'An invoice will be issued with a proration for the current month.'
    } else {
      return 'On your next invoice, you will be charged for the new plan, plus a proration for the current month.'
    }
  }, [selectedProduct, prorationBehavior])

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
        <List size="small" className={themingPreset.polar.list}>
          <ProductPriceListItem
            product={subscription.product}
            selected
            themingPreset={themingPreset}
          />
        </List>
        <h3 className="font-medium">Available Plans</h3>
        <List size="small" className={themingPreset.polar.list}>
          {products
            .filter((product) => product.id !== subscription.product_id)
            .map((product) => (
              <ProductPriceListItem
                key={product.id}
                product={product}
                selected={selectedProduct?.id === product.id}
                onSelect={() => setSelectedProduct(product)}
                themingPreset={themingPreset}
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
                You&apos;ll lose access to the following benefits
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
        {needToAddPaymentMethod && (
          <div className="flex flex-row items-center gap-x-2">
            <div className="h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xl">
              <svg viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
                <path
                  fill="#f44336"
                  d="M6.2244898 12.67346931L1.3265307 7.7755102c-.43537415-.43537414-.43537415-1.11564624 0-1.55102039l4.8979591-4.89795913c.43537414-.43537414 1.11564624-.43537414 1.55102039 0l4.89795912 4.89795912c.43537414.43537415.43537414 1.11564625 0 1.5510204L7.7755102 12.6734693c-.43537415.43537415-1.14285713.43537415-1.5510204 0z"
                />
                <path
                  fill="#ffffff"
                  d="M6.33333334 9.38095235c0-.08163265.02721089-.1632653.05442177-.24489796.02721089-.08163265.08163265-.13605442.13605442-.19047619.05442177-.05442176.13605442-.10884353.21768707-.13605442.08163266-.02721088.1632653-.05442176.27210884-.05442176.10884354 0 .1904762.02721088.27210884.05442176.08163266.02721089.1632653.08163266.21768708.13605442.05442176.05442177.10884353.10884354.13605442.1904762.02721088.08163264.05442176.1632653.05442176.24489795s-.02721088.1632653-.05442176.24489795c-.02721089.08163266-.08163266.13605442-.13605442.1904762-.05442177.05442176-.13605442.10884353-.21768708.13605441-.08163265.02721089-.1632653.05442177-.27210884.05442177-.10884353 0-.19047618-.02721088-.27210884-.05442177-.08163265-.02721088-.13605442-.08163265-.21768707-.13605442-.05442177-.05442177-.10884353-.10884353-.13605442-.19047619-.02721088-.08163265-.05442177-.13605442-.05442177-.24489795zm1.14285713-1.25170067h-.97959182L6.36054423 4.0204082h1.25170066l-.13605442 4.10884348z"
                />
              </svg>
            </div>
            <p className="text-polar-600 text-sm dark:text-yellow-200">
              You need to add a payment method before updating your plan. Head
              to the&nbsp;
              <Link href={settingsPath} className="underline">
                Customer Portal Settings
              </Link>
              &nbsp; to add a payment method.
            </p>
          </div>
        )}
        <Button
          disabled={!canChangePlan}
          loading={updateSubscription.isPending}
          onClick={onConfirm}
          size="lg"
          className={themingPreset.polar.button}
        >
          Change Plan
        </Button>
      </div>
    </div>
  )
}

export default CustomerChangePlanModal
