'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { resolveBenefitIcon } from '@/components/Subscriptions/utils'
import { Organization } from '@polar-sh/sdk'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useSubscriptionBenefits } from 'polarkit/hooks'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const { data: benefits } = useSubscriptionBenefits(organization.name, 100)

  return (
    <DashboardBody className="flex flex-row items-start gap-x-8">
      <ShadowBoxOnMd className="w-2/3">
        {benefits?.items?.map((benefit) => (
          <div key={benefit.id} className="flex flex-row p-2">
            <div className="flex flex-row items-center gap-x-4">
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
      </ShadowBoxOnMd>
      <ShadowBoxOnMd className="sticky top-8 flex w-1/3 flex-col"></ShadowBoxOnMd>
    </DashboardBody>
  )
}

export default ClientPage
