'use client'

import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import { Organization } from '@polar-sh/sdk'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms'

const ClientPage = ({ organization }: { organization: Organization }) => {
  return (
    <div className="flex w-full flex-col gap-y-8">
      <ShadowBoxOnMd>
        <div className="p-4">
          <div className="flex flex-row items-start justify-between pb-8">
            <h2 className="text-lg font-medium">Issues looking for funding</h2>
          </div>
          <IssuesLookingForFunding organization={organization} />
        </div>
      </ShadowBoxOnMd>
    </div>
  )
}

export default ClientPage
