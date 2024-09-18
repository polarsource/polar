import {
  useOrganizationAccount,
  useProducts,
  useSearchDonations,
  useSearchTransactions,
} from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  Account,
  ListResourceDonation,
  ListResourceOrder,
  ListResourceProduct,
  ListResourceTransaction,
  Organization,
} from '@polar-sh/sdk'
import { useContext, useMemo } from 'react'
import { UpsellStepProps } from './CreatorUpsell'

const shouldUpsellCustomizeOrganization = (org: Organization) => {
  return typeof org.avatar_url !== 'string'
}

const shouldUpsellCreateProduct = (products?: ListResourceProduct) => {
  const nonFreeProducts =
    products?.items.filter((tier) => tier.type !== 'free') ?? []

  return nonFreeProducts.length === 0
}

const shouldUpsellFirstOrder = (orders?: ListResourceOrder) => {
  return orders?.pagination.total_count === 0 ?? true
}

const shouldUpsellPayoutConnection = (account?: Account) => {
  return !account
}

const shouldUpsellPayout = (payouts?: ListResourceTransaction) => {
  return payouts?.pagination.total_count === 0 ?? true
}

const shouldUpsellDonation = (
  org: Organization,
  donations?: ListResourceDonation,
) => {
  if (!org.donations_enabled) return true

  return donations?.pagination.total_count === 0 ?? true
}

export const useUpsellSteps = () => {
  const { organization: currentOrg } = useContext(MaintainerOrganizationContext)
  const { data: account, isLoading: orgAccountLoading } =
    useOrganizationAccount(currentOrg.id)

  const { data: products, isLoading: tiersLoading } = useProducts(currentOrg.id)
  const { data: orders, isLoading: ordersLoading } = useOrders(currentOrg.id)
  const { data: payouts, isLoading: payoutsLoading } = useSearchTransactions({
    accountId: account?.id,
    type: 'payout',
  })
  const { data: donations, isLoading: donationsLoading } = useSearchDonations({
    toOrganizationId: currentOrg.id,
    page: 1,
    limit: 1,
  })

  const isLoading =
    ordersLoading ||
    tiersLoading ||
    payoutsLoading ||
    donationsLoading ||
    orgAccountLoading

  const steps = useMemo(() => {
    const steps: Omit<UpsellStepProps, 'index'>[] = []

    steps.push({
      title: 'Create your organization',
      description: 'Register an organization name with Polar',
      href: `/dashboard/${currentOrg.slug}`,
      done: true,
    })

    steps.push({
      title: 'Customize Organization',
      description: 'Upload an avatar for your Organization',
      href: `/dashboard/${currentOrg.slug}/customize`,
      done: !shouldUpsellCustomizeOrganization(currentOrg),
    })

    steps.push({
      title: 'Setup products & subscriptions',
      description:
        'Sell benefits like Digital downloads, Discord invites & Private GitHub repository access',
      href: `/dashboard/${currentOrg.slug}/products`,
      done: !shouldUpsellCreateProduct(products),
    })

    steps.push({
      title: 'Make your first sale',
      description:
        'Sell a digital product or a subscription to your supporters',
      href: `/dashboard/${currentOrg.slug}/sales`,
      done: !shouldUpsellFirstOrder(orders),
    })

    steps.push({
      title: 'Connect Payout Account',
      description:
        'Let us know which Stripe or Open Collective account we should make payouts to',
      href: `/dashboard/${currentOrg.slug}/finance/account`,
      done: !shouldUpsellPayoutConnection(account),
    })

    steps.push({
      title: 'Withdraw funds to your Payout Account',
      description: 'Time to get paid!',
      href: `/dashboard/${currentOrg.slug}/finance`,
      done:
        !shouldUpsellPayoutConnection(account) && !shouldUpsellPayout(payouts),
    })

    steps.push({
      title: 'Receive your first donation',
      description:
        'Donations without any strings attached are worth celebrating',
      href: `/dashboard/${currentOrg.slug}/donations/overview`,
      done: !shouldUpsellDonation(currentOrg, donations),
    })

    return steps
  }, [currentOrg, orders, products, account, payouts, donations])

  if (isLoading) {
    return []
  } else {
    return steps
  }
}
