'use client'

import { Feed } from '@/components/Feed/Feed'
import { LanguageOutlined } from '@mui/icons-material'
import { Button, Input } from 'polarkit/components/ui/atoms'

export default function Page() {
  return (
    <div className="relative mx-auto mb-24 mt-2 flex max-w-5xl flex-row items-start">
      <div className="absolute left-0 flex max-w-xl flex-col gap-y-4">
        <div className="flex flex-col gap-y-5">
          <h3 className="text-lg">Feed</h3>
          <Input placeholder="Let your community know what you're up to..." />
          <div className="flex flex-row items-center justify-between">
            <div className="dark:text-polar-400 dark:bg-polar-800 dark:border-polar-700 flex flex-row items-center gap-x-2 self-start rounded-full border border-gray-100 bg-white px-3 py-1 text-sm text-gray-400 shadow-lg">
              <LanguageOutlined className="text-blue-500" fontSize="inherit" />
              <span>Public</span>
            </div>
            <Button size="sm" className="self-end">
              Create Post
            </Button>
          </div>
        </div>
        <Feed />
      </div>
      <div className="absolute right-0 flex w-[320px] flex-col gap-y-6">
        <h3 className="dark:text-polar-50 text-lg text-gray-950">
          Maintainers you may know
        </h3>
        <div className="dark:bg-polar-800 dark:border-polar-700 h-[160px] w-full rounded-xl border border-gray-100 bg-white" />
      </div>
    </div>
  )
}
