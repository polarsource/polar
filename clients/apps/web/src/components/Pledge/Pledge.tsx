'use client'

import {
  Issue,
  Pledger,
  PullRequest,
  RewardsSummary,
  Visibility,
} from '@polar-sh/sdk'
import { IssueCard } from 'polarkit/components/pledge'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import { Banner } from 'polarkit/components/ui/molecules'
import posthog from 'posthog-js'
import { useEffect, useState } from 'react'
import Footer from '../Organization/Footer'
import HowItWorks from './HowItWorks'
import PledgeCheckoutPanel from './PledgeCheckoutPanel'

const Pledge = ({
  issue,
  htmlBody,
  pledgers,
  gotoURL,
  rewards,
  pullRequests,
}: {
  issue: Issue
  htmlBody?: string
  pledgers: Pledger[]
  gotoURL?: string
  rewards?: RewardsSummary
  pullRequests?: PullRequest[]
}) => {
  const [amount, setAmount] = useState(0)
  const onAmountChange = (amount: number) => {
    setAmount(amount)
  }

  useEffect(() => {
    if (issue) {
      posthog.capture('Pledge page shown', {
        'Organization ID': issue.repository.organization.id,
        'Organization Name': issue.repository.organization.name,
        'Repository ID': issue.repository.id,
        'Repository Name': issue.repository.name,
        'Issue ID': issue.id,
        'Issue Number': issue.number,
      })
    }
  }, [issue])

  return (
    <>
      {issue.repository.visibility === Visibility.PRIVATE && (
        <Banner color="muted">
          This is an issue in a private repository. Only logged in users that
          are members of {issue.repository.organization.name} can see it.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Left side */}
        <div className="mt-12">
          <IssueCard
            issue={issue}
            htmlBody={htmlBody}
            pledgers={pledgers}
            currentPledgeAmount={amount}
            rewards={rewards}
            pullRequests={pullRequests}
          />
        </div>

        {/* Right side */}
        <div>
          <WhiteCard padding>
            <PledgeCheckoutPanel
              issue={issue}
              gotoURL={gotoURL}
              onAmountChange={onAmountChange}
            />
          </WhiteCard>
        </div>
      </div>

      <HowItWorks />

      <Footer />
    </>
  )
}

export default Pledge
