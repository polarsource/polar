'use client'

import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import { organizationPageLink } from '@/utils/nav'
import { components } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { redirect } from 'next/navigation'

const ClientPage = ({
  organization,
  issues,
}: {
  organization: components['schemas']['Organization']
  issues: components['schemas']['ListResource_IssueFunding_']
}) => {
  if (!organization.feature_settings?.issue_funding_enabled) {
    return redirect(organizationPageLink(organization))
  }

  return (
    <div className="flex w-full flex-col items-center gap-y-8">
      <ShadowBoxOnMd className="flex w-full max-w-4xl flex-col">
        <div className="p-4">
          <div className="flex flex-row items-start justify-between pb-8">
            <h2 className="text-lg font-medium">Issues looking for funding</h2>
          </div>
          <IssuesLookingForFunding
            organization={organization}
            issues={issues}
          />
        </div>
      </ShadowBoxOnMd>
    </div>
  )
}

export default ClientPage
