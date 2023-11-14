'use client'

import { Feed } from '@/components/Feed/Feed'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'

export default function Page() {
  return (
    <div className="relative mx-auto -mt-12 mb-24 flex max-w-5xl flex-row items-start">
      <Tabs
        className="absolute left-0 flex w-full max-w-xl flex-col gap-y-8"
        defaultValue="for-you"
      >
        <div className="flex w-full flex-row items-center justify-between">
          <h3 className="dark:text-polar-50 text-lg text-gray-950">Feed</h3>
          <TabsList className="dark:border-polar-700 dark:border">
            <TabsTrigger size="small" value="for-you">
              For You
            </TabsTrigger>
            <TabsTrigger size="small" value="subscriptions">
              Subscriptions
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent className="w-full" value="for-you">
          <Feed />
        </TabsContent>
      </Tabs>
      <div className="absolute right-0 flex w-[320px] flex-col gap-y-6">
        <h3 className="dark:text-polar-50 text-lg text-gray-950">
          Maintainers you may know
        </h3>
        <div className="dark:bg-polar-800 dark:border-polar-700 h-[160px] w-full rounded-xl border border-gray-100 bg-white" />
      </div>
    </div>
  )
}
