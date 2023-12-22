'use client'

import { Benefit } from '@/components/Benefit/Benefit'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { resolveBenefitIcon } from '@/components/Subscriptions/utils'
import { Organization } from '@polar-sh/sdk'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useSubscriptionBenefits, useSubscriptionTiers } from 'polarkit/hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const [selectedBenefit, setSelectedBenefit] = useState<Benefit | undefined>()
  const { data: benefits } = useSubscriptionBenefits(organization.name, 100)
  const { data: subscriptionTiers } = useSubscriptionTiers(
    organization.name,
    100,
  )

  const benefitSubscriptionTiers = useMemo(
    () =>
      subscriptionTiers?.items?.filter((tier) =>
        tier.benefits.some((benefit) => benefit.id === selectedBenefit?.id),
      ),
    [subscriptionTiers, selectedBenefit],
  )

  useEffect(() => {
    setSelectedBenefit(benefits?.items?.[0])
  }, [benefits])

  const handleSelectBenefit = useCallback(
    (benefit: Benefit) => () => {
      setSelectedBenefit(benefit)
    },
    [],
  )

  return (
    <DashboardBody className="flex flex-row items-start gap-x-8">
      <ShadowBoxOnMd className="flex w-2/3 flex-col gap-y-6">
        <h2 className="text-lg font-medium">Benefits</h2>
        <div className="flex flex-col gap-y-2">
          {benefits?.items?.map((benefit) => (
            <div
              key={benefit.id}
              className={twMerge(
                'dark:hover:bg-polar-800 flex cursor-pointer flex-row justify-between gap-x-8 rounded-2xl border px-4 py-3 shadow-sm transition-colors dark:border-transparent',
                benefit.id === selectedBenefit?.id &&
                  'dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 border-blue-100 bg-blue-50 hover:bg-blue-100',
              )}
              onClick={handleSelectBenefit(benefit)}
            >
              <div className="flex flex-row items-center gap-x-3">
                <div
                  className={twMerge(
                    'flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-blue-500 dark:bg-blue-950 dark:text-blue-400',
                  )}
                >
                  {resolveBenefitIcon(benefit, true)}
                </div>
                <span className="text-sm">{benefit.description}</span>
              </div>
            </div>
          ))}
        </div>
      </ShadowBoxOnMd>
      {selectedBenefit && (
        <ShadowBoxOnMd className="sticky top-8 flex w-1/3 flex-col gap-y-8">
          <div className="flex flex-row items-center gap-x-3">
            <div
              className={twMerge(
                'flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-blue-500 dark:bg-blue-950 dark:text-blue-400',
              )}
            >
              {resolveBenefitIcon(selectedBenefit, true)}
            </div>
            <span className="text-sm">{selectedBenefit.description}</span>
          </div>
          <div className="flex flex-col gap-y-2">
            {benefitSubscriptionTiers?.map((tier) => (
              <div key={tier.id}>{tier.name}</div>
            ))}
          </div>
        </ShadowBoxOnMd>
      )}
    </DashboardBody>
  )
}

export default ClientPage
