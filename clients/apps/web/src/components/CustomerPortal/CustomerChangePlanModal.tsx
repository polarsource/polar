'use client'

import {
  useCustomerPaymentMethods,
  useCustomerSubscriptionChangePreview,
  useCustomerUpdateSubscription,
} from '@/hooks/queries/customerPortal'
import { isFreePrice } from '@/utils/product'
import { formatTrialEnd, useTrialChangeOutcome } from '@/utils/trial-change'
import { Client, schemas } from '@polar-sh/client'
import { Alert, Button, Status } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { type KeyboardEvent, useCallback, useMemo, useState } from 'react'
import { resolveBenefitIcon } from '../Benefit/utils'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { toast } from '../Toast/use-toast'
import { PortalDialog } from './PortalDialog'
import { PortalText } from './PortalPrimitives'

const INTERVAL_ADJECTIVES: Record<schemas['RecurringInterval'], string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
}

const PlanOption = ({
  product,
  currency,
  selected,
  current,
  focusable,
  onSelect,
}: {
  product: schemas['CustomerProduct']
  currency: string
  selected: boolean
  current?: boolean
  focusable?: boolean
  onSelect?: () => void
}) => (
  <Box
    alignItems="center"
    justifyContent="between"
    columnGap="l"
    paddingHorizontal="l"
    paddingVertical="m"
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    backgroundColor={
      selected
        ? 'background-secondary'
        : current
          ? 'background-primary'
          : { base: 'background-primary', hover: 'background-secondary' }
    }
    cursor={current ? 'default' : 'pointer'}
    transitionProperty="colors"
    transitionDuration="fast"
    onClick={current ? undefined : onSelect}
    onKeyDown={
      current
        ? undefined
        : (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect?.()
            }
          }
    }
    role={current ? undefined : 'radio'}
    aria-checked={current ? undefined : selected}
    tabIndex={current ? undefined : focusable ? 0 : -1}
  >
    <Box alignItems="center" columnGap="m" minWidth={0}>
      <Box
        width={16}
        height={16}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
        borderRadius="full"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor={selected ? 'background-inverse' : 'background-primary'}
        opacity={current ? 0 : 1}
      >
        {selected ? (
          <Box
            width={6}
            height={6}
            borderRadius="full"
            backgroundColor="background-primary"
          />
        ) : null}
      </Box>
      <PortalText block className="truncate text-sm">
        {product.name}
      </PortalText>
      {current ? <Status size="small" color="gray" status="Current" /> : null}
    </Box>
    <PortalText tone="secondary" className="text-sm whitespace-nowrap">
      <ProductPriceLabel product={product} currency={currency} />
    </PortalText>
  </Box>
)

const BenefitChanges = ({
  title,
  benefits,
  tone,
}: {
  title: string
  benefits: schemas['CustomerProduct']['benefits']
  tone: 'primary' | 'secondary'
}) => (
  <Box flexDirection="column" rowGap="s">
    <PortalText tone="secondary" className="text-sm">
      {title}
    </PortalText>
    {benefits.map((benefit) => (
      <Box key={benefit.id} alignItems="center" columnGap="s">
        <PortalText tone={tone}>
          {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
        </PortalText>
        <PortalText tone={tone} className="text-sm">
          {benefit.description}
        </PortalText>
      </Box>
    ))}
  </Box>
)

const getNextInvoiceType = (
  preview: schemas['CustomerSubscriptionChangePreview'],
): 'charge' | 'balance' | 'credit' => {
  if (preview.total_amount <= 0) return 'credit'
  if (preview.due_amount === 0) return 'balance'
  return 'charge'
}

interface CustomerChangePlanModalProps {
  isShown: boolean
  api: Client
  organization: schemas['CustomerOrganization']
  products: schemas['CustomerProduct'][]
  subscription: schemas['CustomerSubscription']
  hide: () => void
  onUserSubscriptionUpdate: (
    subscription: schemas['CustomerSubscription'],
  ) => void
}

const ARROW_KEY_OFFSETS: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

const ChangePlanDialog = ({
  api,
  organization,
  products: _products,
  subscription,
  hide,
  onUserSubscriptionUpdate,
}: Omit<CustomerChangePlanModalProps, 'isShown'>) => {
  const router = useRouter()
  const products = useMemo(
    () => _products.filter((p) => p.is_recurring),
    [_products],
  )

  const [selectedProduct, setSelectedProduct] = useState<
    schemas['CustomerProduct'] | null
  >(null)

  const paymentMethods = useCustomerPaymentMethods(api)

  const hasPaymentMethod = useMemo(() => {
    return (paymentMethods.data?.items.length ?? 0) > 0
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

  const trialOutcome = useTrialChangeOutcome(
    subscription,
    selectedProduct,
    prorationBehavior,
  )

  const changePreview = useCustomerSubscriptionChangePreview(
    api,
    subscription.id,
    selectedProduct?.id,
  )

  const preview =
    changePreview.data && !changePreview.isFetching && !changePreview.isError
      ? changePreview.data
      : null

  const invoicingMessage = useMemo((): string | null => {
    if (!selectedProduct) return null

    if (trialOutcome?.kind === 'continues') {
      return `Your trial will continue until ${formatTrialEnd(trialOutcome.trialEnd)}. You won't be charged before then.`
    }

    if (trialOutcome?.kind === 'ends') {
      return `This will end my trial and charge me immediately for ${selectedProduct.name}.`
    }

    if (preview === null) return null

    const isIntervalChange =
      selectedProduct.recurring_interval !== subscription.recurring_interval ||
      selectedProduct.recurring_interval_count !==
        subscription.recurring_interval_count

    if (preview.proration_behavior === 'invoice' && isIntervalChange) {
      const interval = selectedProduct.recurring_interval ?? 'month'
      const count = selectedProduct.recurring_interval_count ?? 1
      const newPeriod =
        count > 1 ? `${count}-${interval}` : INTERVAL_ADJECTIVES[interval]

      switch (getNextInvoiceType(preview)) {
        case 'charge':
          return `You'll be charged immediately for the new ${newPeriod} plan.`
        case 'balance':
          return `The new ${newPeriod} plan will be paid from your balance.`
        case 'credit':
          return `Your previous payment will appear as a credit on your next invoice.`
      }
    }

    switch (preview.proration_behavior) {
      case 'invoice':
        return "You'll be charged immediately, with a proration for the current period."
      case 'prorate':
        return 'Your next invoice will include the new plan plus the proration for the current period.'
      case 'next_period':
        return 'The new plan will be applied on your next billing cycle.'
      case 'reset':
        return "You'll be charged the full amount for the new plan immediately, and your billing period restarts today."
    }
  }, [selectedProduct, subscription, preview, trialOutcome])

  const canChangePlan = useMemo(() => {
    if (!selectedProduct) return false
    const isSamePlan = selectedProduct?.id === subscription.product_id
    if (isSamePlan) return false

    const selectedPlanIsFree = selectedProduct?.prices.some(isFreePrice)

    if (selectedPlanIsFree) return true

    return hasPaymentMethod
  }, [hasPaymentMethod, selectedProduct, subscription])

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
        title: 'Subscription updated',
        description: 'Your plan has been updated.',
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

  const selectedIndex = availableProducts.findIndex(
    (product) => product.id === selectedProduct?.id,
  )

  const onPlanKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const offset = ARROW_KEY_OFFSETS[event.key]
    const count = availableProducts.length
    if (!offset || count === 0) return
    event.preventDefault()
    const nextIndex =
      selectedIndex === -1
        ? offset > 0
          ? 0
          : count - 1
        : (selectedIndex + offset + count) % count
    setSelectedProduct(availableProducts[nextIndex])
    const radios =
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')
    radios[nextIndex]?.focus()
  }

  return (
    <PortalDialog
      isShown
      hide={hide}
      title="Change plan"
      description={`You're currently on ${subscription.product.name}.`}
      actions={
        <>
          <Button variant="ghost" onClick={hide}>
            Cancel
          </Button>
          <Button
            disabled={!canChangePlan}
            loading={updateSubscription.isPending}
            onClick={onConfirm}
          >
            {trialOutcome?.kind === 'ends'
              ? 'Change plan and end trial'
              : 'Change plan'}
          </Button>
        </>
      }
    >
      <Box
        flexDirection="column"
        rowGap="s"
        role="radiogroup"
        aria-label="Available plans"
        onKeyDown={onPlanKeyDown}
      >
        <PlanOption
          product={subscription.product}
          currency={subscription.currency}
          selected={false}
          current
        />
        {availableProducts.map((product, index) => (
          <PlanOption
            key={product.id}
            product={product}
            currency={subscription.currency}
            selected={index === selectedIndex}
            focusable={
              selectedIndex === -1 ? index === 0 : index === selectedIndex
            }
            onSelect={() => setSelectedProduct(product)}
          />
        ))}
      </Box>
      {availableProducts.length === 0 && (
        <PortalText tone="secondary" className="text-sm">
          No other plans are available.
        </PortalText>
      )}
      {addedBenefits.length > 0 && (
        <BenefitChanges
          title="You'll get access to"
          benefits={addedBenefits}
          tone="primary"
        />
      )}
      {removedBenefits.length > 0 && (
        <BenefitChanges
          title="You'll lose access to"
          benefits={removedBenefits}
          tone="secondary"
        />
      )}
      {invoicingMessage && (
        <PortalText tone="secondary" className="text-sm text-pretty">
          {invoicingMessage}
        </PortalText>
      )}
      {needToAddPaymentMethod && (
        <Alert
          variant="warning"
          title="Payment method required"
          description="Add a payment method on the billing page before switching to a paid plan."
        />
      )}
    </PortalDialog>
  )
}

const CustomerChangePlanModal = ({
  isShown,
  ...props
}: CustomerChangePlanModalProps) =>
  isShown ? <ChangePlanDialog {...props} /> : null

export default CustomerChangePlanModal
