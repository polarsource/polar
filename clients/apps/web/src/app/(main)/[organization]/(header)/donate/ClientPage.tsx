'use client'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { Issue, Organization } from '@polar-sh/sdk'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import Checkout from './Checkout'

const ClientPage = ({
  organization,
  defaultAmount,
  issue,
}: {
  organization: Organization
  defaultAmount: number
  issue: Issue | undefined
}) => {
  useTrafficRecordPageView({ organization: organization })

  if (!organization.donations_enabled) {
    return (
      <div className="w-full pt-8 text-center text-gray-500">
        {organization.name} does not accept donations via Polar at this moment.
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-y-24">
      <div className="flex flex-col gap-24 lg:flex-row lg:gap-16">
        <div className="flex w-full flex-col items-center gap-y-6">
          <ShadowBoxOnMd className="flex w-full max-w-xl flex-col gap-y-8">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-xl">Donate</h2>

              {issue ? (
                <p className="dark:text-polar-500 text-gray-500">
                  Say thanks with a donation to {organization.name} for fixing{' '}
                  {issue.repository.organization.name}/{issue.repository.name}#
                  {issue.number}
                </p>
              ) : (
                <p className="dark:text-polar-500 text-gray-500">
                  Say thanks with a donation to {organization.name}
                </p>
              )}
            </div>

            <Checkout
              organization={organization}
              defaultAmount={defaultAmount}
              issue={issue}
            />
          </ShadowBoxOnMd>
        </div>
      </div>
    </div>
  )
}

export default ClientPage
