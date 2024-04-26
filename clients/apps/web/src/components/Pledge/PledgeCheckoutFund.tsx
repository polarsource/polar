import { useListTeams } from '@/hooks'
import {
  BuildingOfficeIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { Issue } from '@polar-sh/sdk'
import Link from 'next/link'
import { Tabs, TabsContent } from 'polarkit/components/ui/atoms/tabs'
import PledgeCheckoutFundByTeam from './PledgeCheckoutFundByTeam'
import PledgeCheckoutFundOnCompletion from './PledgeCheckoutFundOnCompletion'
import PledgeCheckoutFundToday from './PledgeCheckoutFundToday'
import { PledgeTabsList, PledgeTabsTrigger } from './PledgeCheckoutPanel'

const PledgeCheckoutFund = ({
  issue,
  gotoURL,
  onAmountChange: onAmountChangeProp,
}: {
  issue: Issue
  gotoURL?: string
  onAmountChange?: (amount: number) => void
}) => {
  const allTeams = useListTeams()
  const teamsEnabled = allTeams.length > 0

  return (
    <div className="space-y-4 py-4">
      <div>
        <label
          htmlFor="funding_method"
          className="dark:text-polar-200 mb-2 text-sm font-medium text-gray-500"
        >
          Funding method
        </label>

        <Tabs defaultValue="fund_today" className="mt-2">
          <PledgeTabsList className="w-full" vertical>
            <FundingMethodTab
              value="fund_today"
              icon={<CurrencyDollarIcon className="h-6 w-6" />}
              title="Fund today"
              subtitle="Paid today. Held by Polar until completion."
            />
            <FundingMethodTab
              value="fund_on_completion"
              icon={<ClockIcon className="h-6 w-6" />}
              title="Fund on completion"
              subtitle="Get an invoice when the issue is completed."
            />
            {teamsEnabled && (
              <FundingMethodTab
                value="fund_by_team"
                icon={<BuildingOfficeIcon className="h-6 w-6" />}
                title="Fund by team"
                subtitle="Pledges are paid by your employer."
              />
            )}
          </PledgeTabsList>
          <TabsContent value="fund_today">
            <PledgeCheckoutFundToday
              issue={issue}
              gotoURL={gotoURL}
              onAmountChange={onAmountChangeProp}
            />
          </TabsContent>
          <TabsContent value="fund_on_completion">
            <PledgeCheckoutFundOnCompletion issue={issue} />
          </TabsContent>
          <TabsContent value="fund_by_team">
            <PledgeCheckoutFundByTeam issue={issue} />
          </TabsContent>
        </Tabs>
      </div>

      <p className="dark:text-polar-500 text-sm text-gray-600">
        By funding this issue, you agree to our{' '}
        <Link href="https://polar.sh/legal/terms" className="underline">
          Terms of Service
        </Link>{' '}
        and understand our{' '}
        <Link href="https://polar.sh/legal/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}

export default PledgeCheckoutFund

const FundingMethodTab = ({
  value,
  icon,
  title,
  subtitle,
}: {
  value: string
  icon: React.ReactElement
  title: string
  subtitle: string
}) => (
  <PledgeTabsTrigger
    value={value}
    className="w-full !rounded-lg md:flex-col md:items-center"
  >
    <div className="flex w-full items-center gap-4 px-1 text-left">
      <div className="shrink-0">{icon}</div>
      <div className="w-full">
        <div>{title}</div>
        <div className="w-full truncate text-xs font-normal opacity-50">
          {subtitle}
        </div>
      </div>
    </div>
  </PledgeTabsTrigger>
)
