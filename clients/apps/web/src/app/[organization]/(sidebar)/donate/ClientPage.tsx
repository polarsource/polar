'use client'
import { HighlightedTiersEditor } from '@/components/Profile/HighlightedTiersEditor/HighlightedTiersEditor'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { Issue, Organization, Product } from '@polar-sh/sdk'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import Checkout from './Checkout'

const ClientPage = ({
  organization,
  userOrganizations,
  products,
  defaultAmount,
  issue,
}: {
  organization: Organization
  userOrganizations: Organization[]
  products: Product[]
  defaultAmount: number
  issue: Issue | undefined
}) => {
  useTrafficRecordPageView({ organization: organization })

  if (!organization.donations_enabled) {
    return (
      <div className="w-full pt-8 text-center text-gray-500">
        {organization.pretty_name ?? organization.slug} does not accept
        donations via Polar at this moment.
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-y-24">
      <div className="flex flex-col gap-24 lg:flex-row lg:gap-16">
        <div className="flex w-full min-w-0 flex-shrink flex-col gap-y-16 md:max-w-xl xl:max-w-3xl">
          <div className="flex w-full flex-col gap-y-6">
            <ShadowBoxOnMd className="flex flex-col gap-y-8">
              <div className="flex flex-col gap-y-2">
                <h2 className="text-xl">Donate</h2>

                {issue ? (
                  <p className="dark:text-polar-500 text-gray-500">
                    Say thanks with a donation to{' '}
                    {organization.pretty_name ?? organization.slug} for fixing{' '}
                    {issue.repository.organization.name}/{issue.repository.name}
                    #{issue.number}
                  </p>
                ) : (
                  <p className="dark:text-polar-500 text-gray-500">
                    Say thanks with a donation to{' '}
                    {organization.pretty_name ?? organization.slug}
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

        <div className="hidden w-full flex-col gap-y-16 md:max-w-52 lg:flex lg:max-w-72">
          <HighlightedTiersEditor
            organization={organization}
            userOrganizations={userOrganizations}
            products={products}
          />
        </div>
      </div>
    </div>
  )
}

export default ClientPage
