import { useOrganizationAccount, useProducts } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { Account, ListResourceProduct } from '@polar-sh/sdk'
import { useContext, useMemo } from 'react'
import { UpsellStepProps } from './CreatorUpsell'

const shouldUpsellCreateProduct = (products?: ListResourceProduct) => {
  const nonFreeProducts =
    products?.items.filter((tier) => tier.type !== 'free') ?? []

  return nonFreeProducts.length === 0
}

const shouldUpsellPayoutConnection = (account?: Account) => {
  return !account
}

export const useUpsellSteps = () => {
  const { organization: currentOrg } = useContext(MaintainerOrganizationContext)
  const { data: account, isLoading: orgAccountLoading } =
    useOrganizationAccount(currentOrg.id)

  const { data: products, isLoading: tiersLoading } = useProducts(currentOrg.id)

  const isLoading = tiersLoading || orgAccountLoading

  const steps = useMemo(() => {
    const steps: Omit<UpsellStepProps, 'index'>[] = []

    steps.push({
      title: 'Create your organization',
      description: 'Register an organization name with Polar',
      href: `/dashboard/${currentOrg.slug}`,
      done: true,
      CTA: 'Create',
    })

    steps.push({
      title: 'Create products & subscriptions',
      description:
        'Sell benefits like License Keys & Private GitHub repository access',
      href: `/dashboard/${currentOrg.slug}/products/new`,
      done: !shouldUpsellCreateProduct(products),
      CTA: 'Create',
    })

    steps.push({
      title: 'Connect Payout Account',
      description: 'Connect your Polar account with Stripe or Open Collective',
      href: `/dashboard/${currentOrg.slug}/finance/account`,
      done: !shouldUpsellPayoutConnection(account),
      CTA: 'Connect',
    })

    return steps
  }, [currentOrg, products, account])

  if (isLoading) {
    return []
  } else {
    return steps
  }
}
