'use client'

import { Feed } from '@/components/Feed/Feed'

export default function Page() {
  return (
    <div className="relative flex flex-row items-start">
      <div className="absolute left-0 flex w-full max-w-xl flex-col gap-y-8 pb-12">
        <Feed />
      </div>
      <div className="absolute right-0 flex w-full max-w-md flex-col gap-y-6">
        <h3 className="dark:text-polar-50 text-lg text-gray-950">
          Maintainers you may know
        </h3>
        <div className="dark:bg-polar-800 dark:border-polar-700 h-[160px] w-full rounded-xl border border-gray-100 bg-white" />
      </div>
    </div>
  )
}
