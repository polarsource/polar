import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext, useMemo } from 'react'
import { UpsellStepProps } from './CreatorUpsell'

export const useUpsellSteps = () => {
  const { organization: currentOrg, onboarding } = useContext(
    MaintainerOrganizationContext,
  )

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
      done: onboarding.createProductCompleted,
      CTA: 'Create',
    })

    return steps
  }, [currentOrg, onboarding])

  return steps
}
