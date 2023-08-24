import { Issue } from 'polarkit/api/client'
import { IssueCard } from 'polarkit/components/pledge'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import { useState } from 'react'
import Footer from '../Organization/Footer'
import HowItWorks from './HowItWorks'
import PledgeForm from './PledgeForm'

const Pledge = ({
  issue,
  asOrg,
  gotoURL,
}: {
  issue: Issue
  asOrg?: string
  gotoURL?: string
}) => {
  const [amount, setAmount] = useState(0)
  const onAmountChange = (amount: number) => {
    setAmount(amount)
  }

  return (
    <>
      <div className="flex flex-col items-center ">
        <img
          src={issue.repository.organization.avatar_url}
          className="h-16 w-16 rounded-full border-2 border-white shadow"
        />
        <div className="text-center text-lg font-medium text-gray-900 dark:text-gray-300">
          {issue.repository.organization.pretty_name ||
            issue.repository.organization.name}
        </div>
        <div className="text-center text-gray-500 dark:text-gray-400">
          {issue.repository.description}
        </div>
        <h1 className="pt-4 text-center text-3xl text-gray-900 dark:text-gray-300 md:text-4xl">
          Fund{' '}
          {issue.repository.organization.pretty_name ||
            issue.repository.organization.name}
          &apos;s work on this issue
        </h1>
      </div>

      <div className="flex flex-col">
        <WhiteCard
          className="flex flex-col items-stretch rounded-none p-2 text-center md:flex-row md:rounded-xl md:pr-0"
          padding={false}
        >
          <div className="md:w-1/2">
            <IssueCard
              issue={issue}
              className="bg-grid-pattern dark:bg-grid-pattern-dark border-blue-100 bg-blue-50 bg-[12px_12px] dark:border-blue-500/20 dark:bg-blue-500/20"
              currentPledgeAmount={amount}
            />
          </div>
          <div className="text-left md:w-1/2">
            <div className="py-5 px-3 md:px-6 ">
              <PledgeForm
                issue={issue}
                asOrg={asOrg}
                gotoURL={gotoURL}
                onAmountChange={onAmountChange}
              />
            </div>
          </div>
        </WhiteCard>
      </div>

      <HowItWorks />

      <Footer />
    </>
  )
}

export default Pledge
