'use client'

import { InlineModalHeader } from '@polar-sh/orbit'
import {
  useCustomerPaymentMethods,
  useCustomerUpdateSubscription,
} from '@/hooks/queries/customerPortal'
import { hasLegacyRecurringPrices, isFreePrice } from '@/utils/product'
import { formatTrialEnd, useTrialChangeOutcome } from '@/utils/trial-change'
import { Client, schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { List, ListItem } from '@polar-sh/orbit'
import { Checkbox } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { resolveBenefitIcon } from '../Benefit/utils'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { toast } from '../Toast/use-toast'

const ProductPriceListItem = ({
  product,
  currency,
  selected,
  onSelect,
}: {
  product: schemas['CustomerProduct']
  currency: string
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
      <Text variant="title" as="h3">
        {product.name}
      </Text>
      <ProductPriceLabel product={product} currency={currency} />
    </ListItem>
  )
}

const BenefitChangeList = ({
  title,
  tone,
  benefits,
}: {
  title: string
  tone: 'success' | 'danger'
  benefits: schemas['CustomerProduct']['benefits']
}) => {
  if (benefits.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="title" as="h3" color={tone}>
        {title}
      </Text>
      <Box flexDirection="column" rowGap="s">
        {benefits.map((benefit) => (
          <Box key={benefit.id} alignItems="center" columnGap="s">
            <Box
              width={24}
              height={24}
              flexShrink={0}
              alignItems="center"
              justifyContent="center"
              borderRadius="full"
              backgroundColor="background-accent"
              color="text-accent"
            >
              {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
            </Box>
            <Text>{benefit.description}</Text>
          </Box>
        ))}
      </Box>
    </Box>
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
  organization: schemas['CustomerOrganization']
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

  const [selectedProduct, setSelectedProduct] = useState<
    schemas['CustomerProduct'] | null
  >(null)

  const paymentMethods = useCustomerPaymentMethods(api)

  const hasPaymentMethod = useMemo(() => {
    return paymentMethods.data?.items.length ?? 0 > 0
  }, [paymentMethods.data])

  const needToAddPaymentMethod = useMemo(() => {
    if (!selectedProduct) return false

    const selectedPlanIsFree = selectedProduct?.prices.some(isFreePrice)

    if (selectedPlanIsFree) return false

    return !hasPaymentMethod
  }, [selectedProduct, hasPaymentMethod])

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
    () => organization.proration_behavior,
    [organization],
  )

  const trialOutcome = useTrialChangeOutcome(subscription, selectedProduct)

  const isTrialing = subscription.status === 'trialing'

  const [willTriggerImmediateCycle, nextInvoiceType] = useMemo(():
    | [false, null]
    | [true, 'charge' | 'credit'] => {
    if (!selectedProduct) return [false, null]
    if (isTrialing) return [false, null]

    const willTrigger =
      prorationBehavior !== 'next_period' &&
      selectedProduct.recurring_interval !==
        subscription.product.recurring_interval

    if (!willTrigger) return [false, null]

    const newPrice = selectedProduct.prices.reduce((acc, price) => {
      if (price.amount_type === 'fixed') {
        return acc + price.price_amount
      }

      return acc
    }, 0)

    const currentPrice = subscription.amount

    const chargeOrCredit = newPrice > currentPrice ? 'charge' : 'credit'

    return [willTrigger, chargeOrCredit]
  }, [selectedProduct, prorationBehavior, subscription, isTrialing])

  const invoicingMessage = useMemo(() => {
    if (!selectedProduct) return null

    if (trialOutcome?.kind === 'continues') {
      return `Your trial will continue until ${formatTrialEnd(trialOutcome.trialEnd)}. You won't be charged before then.`
    }

    if (trialOutcome?.kind === 'ends') {
      return `This will end my trial and charge me immediately for ${selectedProduct.name}.`
    }

    if (willTriggerImmediateCycle) {
      const newPeriod =
        selectedProduct.recurring_interval === 'month' ? 'monthly' : 'yearly'

      if (nextInvoiceType === 'charge') {
        return `I'll be charged immediately for the new ${newPeriod} plan.`
      } else {
        return `My previous payment will appear as a credit on my next invoice.`
      }
    }

    switch (prorationBehavior) {
      case 'invoice':
        return "I'll be charged immediately with a proration for the current month."
      case 'prorate':
        return 'Your next invoice will include the new plan plus the proration for the current month.'
      case 'next_period':
        return 'The new plan will be applied on your next billing cycle.'
    }
  }, [
    selectedProduct,
    prorationBehavior,
    willTriggerImmediateCycle,
    nextInvoiceType,
    trialOutcome,
  ])

  const willIssueInvoice =
    trialOutcome?.kind === 'ends' ||
    willTriggerImmediateCycle ||
    prorationBehavior === 'invoice'
  const [approveImmediateInvoice, setApproveImmediateInvoice] = useState(false)

  const canChangePlan = useMemo(() => {
    if (!selectedProduct) return false
    const isSamePlan = selectedProduct?.id === subscription.product_id
    if (isSamePlan) return false

    if (willIssueInvoice && !approveImmediateInvoice) return false

    const selectedPlanIsFree = selectedProduct?.prices.some(isFreePrice)

    if (selectedPlanIsFree) return true

    return hasPaymentMethod
  }, [
    hasPaymentMethod,
    selectedProduct,
    subscription,
    willIssueInvoice,
    approveImmediateInvoice,
  ])

  const updateSubscription = useCustomerUpdateSubscription(api)
  const onConfirm = useCallback(async () => {
    if (!selectedProduct) return
    const { data, error } = await updateSubscription.mutateAsync({
      id: subscription.id,
      body: {
        product_id: selectedProduct.id,
      },
    })
    if (error) {
      const errorMessage =
        typeof error.detail === 'string'
          ? error.detail
          : 'Failed to update subscription'
      toast({
        title: 'Error updating subscription',
        description: errorMessage,
        variant: 'error',
      })
    }
    if (data) {
      toast({
        title: 'Subscription Updated',
        description: `Subscription was updated successfully`,
      })
      onUserSubscriptionUpdate(data)
      router.refresh()
      hide()
    }
  }, [
    updateSubscription,
    selectedProduct,
    subscription,
    onUserSubscriptionUpdate,
    hide,
    router,
  ])

  const availableProducts = useMemo(
    () =>
      products
        .filter((product) => product.id !== subscription.product_id)
        .sort((a, b) =>
          a.name.localeCompare(b.name, 'en-US', { numeric: true }),
        ),
    [products, subscription],
  )

  return (
    <Box flexDirection="column" overflowY="auto">
      <InlineModalHeader hide={hide}>
        <Box alignItems="center" justifyContent="between" columnGap="s">
          <Text variant="heading-xs" as="h2">
            Change plan
          </Text>
        </Box>
      </InlineModalHeader>
      <Box flexDirection="column" rowGap="2xl" padding="2xl">
        <Text variant="title" as="h3">
          Current plan
        </Text>
        <List size="small">
          <ProductPriceListItem
            product={subscription.product}
            currency={subscription.currency}
            selected
          />
        </List>
        <Text variant="title" as="h3">
          Available plans
        </Text>
        {availableProducts.length === 0 ? (
          <Box
            borderRadius="l"
            backgroundColor="background-secondary"
            padding="m"
            justifyContent="center"
          >
            <Text color="muted">No other plans available</Text>
          </Box>
        ) : (
          <List size="small">
            {availableProducts.map((product) => (
              <ProductPriceListItem
                key={product.id}
                product={product}
                currency={subscription.currency}
                selected={selectedProduct?.id === product.id}
                onSelect={() => setSelectedProduct(product)}
              />
            ))}
          </List>
        )}
        <Box flexDirection="column" rowGap="xl">
          <BenefitChangeList
            title="You'll get access to the following benefits"
            tone="success"
            benefits={addedBenefits}
          />
          <BenefitChangeList
            title="You'll lose access to the following benefits"
            tone="danger"
            benefits={removedBenefits}
          />
          {invoicingMessage && (
            <Box as="label" display="flex" alignItems="start" columnGap="s">
              {willIssueInvoice && (
                <Box>
                  <Checkbox
                    checked={approveImmediateInvoice}
                    onCheckedChange={(checked) =>
                      setApproveImmediateInvoice(checked === true)
                    }
                  />
                </Box>
              )}

              <Text color="muted" wrap="pretty">
                {invoicingMessage}
              </Text>
            </Box>
          )}
        </Box>
        {needToAddPaymentMethod && (
          <Text color="muted">
            You need to add a payment method before updating your plan. Head to
            the customer portal settings to add a payment method.
          </Text>
        )}
        <Button
          disabled={!canChangePlan}
          loading={updateSubscription.isPending}
          onClick={onConfirm}
          size="lg"
        >
          {trialOutcome?.kind === 'ends'
            ? 'Change plan & end trial'
            : 'Change plan'}
        </Button>
      </Box>
    </Box>
  )
}

export default CustomerChangePlanModal
