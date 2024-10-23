'use client'

import WhiteCard from '@/components/Cards/WhiteCard'
import FAQ from '@/components/Pledge/FAQ'
import HowItWorks from '@/components/Pledge/HowItWorks'
import IssueCard from '@/components/Pledge/IssueCard'
import PledgeCheckoutPanel from '@/components/Pledge/PledgeCheckoutPanel'
import { usePostHog } from '@/hooks/posthog'
import { Issue, Organization, Pledger, RewardsSummary } from '@polar-sh/sdk'
import { Banner } from 'polarkit/components/ui/molecules'
import { useEffect, useState } from 'react'

const ClientPage = ({
  issue,
  organization,
  htmlBody,
  pledgers,
  gotoURL,
  rewards,
}: {
  issue: Issue
  organization: Organization
  htmlBody?: string
  pledgers: Pledger[]
  gotoURL?: string
  rewards?: RewardsSummary
}) => {
  const posthog = usePostHog()

  const [amount, setAmount] = useState(0)
  const onAmountChange = (amount: number) => {
    setAmount(amount)
  }

  useEffect(() => {
    if (issue) {
      posthog.capture('storefront:issues:page:view', {
        organization_id: organization.id,
        organization_name: organization.slug,
        repository_id: issue.repository.id,
        repository_name: issue.repository.name,
        issue_id: issue.id,
        issue_number: issue.number,
      })
    }
  }, [issue, organization])

  return (
    <>
      {issue.repository.is_private && (
        <div className="w-full">
          <Banner color="muted">
            This is an issue in a private repository. Only logged in users that
            are members of {issue.repository.organization.name} can see it.
          </Banner>
        </div>
      )}

      <div className="grid w-full grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Left side */}
        <div className="mt-12">
          <IssueCard
            issue={issue}
            organization={organization}
            htmlBody={htmlBody}
            pledgers={pledgers}
            currentPledgeAmount={amount}
            rewards={rewards}
          />
        </div>

        {/* Right side */}
        <div>
          <WhiteCard padding>
            <PledgeCheckoutPanel
              issue={issue}
              organization={organization}
              gotoURL={gotoURL}
              onAmountChange={onAmountChange}
            />
          </WhiteCard>
        </div>
      </div>

      <HowItWorks />
      <FAQ />
    </>
  )
}

export default ClientPage
