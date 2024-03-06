import { CommandLineIcon, HeartIcon } from '@heroicons/react/24/solid'
import { Issue } from '@polar-sh/sdk'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import PledgeCheckoutContribute from './PledgeCheckoutContribute'
import PledgeCheckoutFund from './PledgeCheckoutFund'

const PledgeCheckoutPanel = ({
  issue,
  gotoURL,
  onAmountChange: onAmountChangeProp,
}: {
  issue: Issue
  gotoURL?: string
  onAmountChange?: (amount: number) => void
}) => {
  return (
    <>
      <form className="flex flex-col">
        <label
          htmlFor="action"
          className="dark:text-polar-200 mb-2 text-sm font-medium text-gray-500"
        >
          I want to&hellip;
        </label>

        <Tabs defaultValue="fund" className="">
          <TabsList className="w-full">
            <TabsTrigger
              value="fund"
              className="data-[state=active]:text-red-600 dark:data-[state=active]:text-red-600"
            >
              <HeartIcon className="h-4 w-4" />
              <div className="dark:text-polar-300 text-gray-700">Fund</div>
            </TabsTrigger>

            <TabsTrigger
              value="contribute"
              className="data-[state=active]:text-green-400 dark:data-[state=active]:text-green-400"
            >
              <CommandLineIcon className="h-4 w-4" />
              <div className="dark:text-polar-300 text-gray-700">
                Contribute
              </div>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="fund">
            <PledgeCheckoutFund
              issue={issue}
              gotoURL={gotoURL}
              onAmountChange={onAmountChangeProp}
            />
          </TabsContent>
          <TabsContent value="contribute">
            <PledgeCheckoutContribute issue={issue} />
          </TabsContent>
        </Tabs>
      </form>
    </>
  )
}

export default PledgeCheckoutPanel
