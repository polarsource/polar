'use client'

import {
  ArrowsRightLeftIcon,
  CommandLineIcon,
  CubeTransparentIcon,
} from '@heroicons/react/24/outline'
import { KeyboardArrowRight } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'

export const API = () => {
  return (
    <div className="dark:bg-polar-950 rounded-4xl flex w-full flex-col gap-y-16 bg-gray-50 p-8 md:p-16 dark:md:bg-[radial-gradient(400px_at_top,rgba(20,20,25,1)_0%,rgba(7,7,9,1)_100%)]">
      <div className="flex flex-col items-center gap-y-8">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Built for Developers
        </span>
        <h1 className="w-fit max-w-2xl text-pretty text-center text-2xl md:text-4xl md:leading-normal">
          The fastest way to add SaaS & digital products to your stack
        </h1>
        <Link href="/docs/guides/nextjs">
          <Button
            fullWidth
            wrapperClassNames="flex flex-row items-center gap-x-1"
            variant="secondary"
          >
            <span>Integration Guide</span>
            <KeyboardArrowRight className="text-lg" fontSize="inherit" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <CommandLineIcon className="h-5 w-5" />
            <h1 className="text-xl">npx polar-init</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-500">
            Bootstrap products, subscriptions, checkouts & webhooks in your
            Next.js or Nuxt.js project.
          </p>
        </div>
        <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <CubeTransparentIcon className="h-5 w-5" />
            <h1 className="text-xl">Sandbox</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-500">
            An isolated sandbox environment, so you can test your integration
            without risk.
          </p>
        </div>
        <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <ArrowsRightLeftIcon className="h-5 w-5" />
            <h1 className="text-xl">Webhooks</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-500">
            Receive reliable webhooks for events, including payments,
            subscriptions, and more.
          </p>
        </div>
      </div>
    </div>
  )
}
