'use client'

import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import { organizationPageLink } from '@/utils/nav'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ListResourceIssueFunding, Organization } from '@polar-sh/sdk'
import { redirect } from 'next/navigation'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'

const ClientPage = ({
  organization,
  issues,
}: {
  organization: Organization
  issues: ListResourceIssueFunding
}) => {
  useTrafficRecordPageView({ organization })

  if (!organization.issue_funding_enabled) {
    return redirect(organizationPageLink(organization))
  }

  return (
    <div className="flex w-full flex-col gap-y-8">
      <ShadowBoxOnMd>
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
