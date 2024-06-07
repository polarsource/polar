import { CommandLineIcon, HeartIcon } from '@heroicons/react/24/solid'
import { Issue } from '@polar-sh/sdk'
import {
  Tabs,
  TabsContent,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
} from 'polarkit/components/ui/atoms/tabs'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import PledgeCheckoutContribute from './PledgeCheckoutContribute'
import PledgeCheckoutFund from './PledgeCheckoutFund'

export const PledgeTabsList = React.forwardRef<
  React.ElementRef<typeof TabsListPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsListPrimitive> & {
    vertical?: boolean
  }
>(({ className, vertical, ...props }, ref) => (
  <TabsListPrimitive
    ref={ref}
    className={twMerge(
      'dark:bg-polar-900 bg-gray-75 dark:ring-polar-900 relative flex h-fit w-fit flex-col items-start gap-2 rounded-xl ring-1 ring-gray-100 md:flex-row',
      vertical
        ? 'flex-col md:flex-col'
        : 'md:flex-row md:items-center md:justify-start',
      className,
    )}
    {...props}
  />
))
PledgeTabsList.displayName = 'PledgeTabsList'

export const PledgeTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTriggerPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsTriggerPrimitive> & {
    size?: 'small' | 'default'
  }
>(({ className, size = 'default', ...props }, ref) => (
  <TabsTriggerPrimitive
    ref={ref}
    className={twMerge(
      'dark:text-white0 dark:data-[state=active]:bg-polar-700 dark:hover:text-polar-50 flex w-full flex-row items-center gap-x-2 px-4 py-2 font-normal hover:text-gray-950 data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-gray-950 data-[state=active]:shadow-sm dark:data-[state=active]:text-white',
      size === 'default' ? 'text-sm' : 'text-xs',
      className,
    )}
    {...props}
  />
))
PledgeTabsTrigger.displayName = 'PledgeTabsTrigger'

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
          <PledgeTabsList className="w-full">
            <PledgeTabsTrigger
              value="fund"
              className="dark:text-white0 dark:data-[state=active]:bg-polar-700 dark:hover:text-polar-50 flex w-full flex-row items-center gap-x-2 px-4 py-2 font-normal hover:text-gray-950 data-[state=active]:rounded-md data-[state=active]:font-medium data-[state=active]:text-red-600  dark:data-[state=active]:text-white"
            >
              <HeartIcon className="h-4 w-4" />
              <div className="dark:text-polar-300 text-gray-700">Fund</div>
            </PledgeTabsTrigger>

            <PledgeTabsTrigger
              value="contribute"
              className="dark:data-[state=active]:bg-polar-700 hover:text-blue-500 data-[state=active]:rounded-md data-[state=active]:bg-white data-[state=active]:text-green-400 dark:data-[state=active]:text-green-400"
            >
              <CommandLineIcon className="h-4 w-4" />
              <div className="dark:text-polar-300 text-gray-700">
                Contribute
              </div>
            </PledgeTabsTrigger>
          </PledgeTabsList>
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
