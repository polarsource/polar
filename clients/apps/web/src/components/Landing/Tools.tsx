'use client'

import { CommandLineIcon } from '@heroicons/react/24/outline'
import { KeyboardArrowRight } from '@mui/icons-material'
import Button from '@polar-sh/ui/components/atoms/button'
import Link from 'next/link'

export const Tools = () => {
  return (
    <div className="dark:bg-polar-900 rounded-4xl flex w-full flex-col gap-y-16 bg-white p-8 md:p-16">
      <div className="flex flex-col items-center gap-y-8">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Command Line Tools
        </span>
        <h1 className="w-fit max-w-2xl text-pretty text-center text-2xl md:text-4xl md:leading-normal">
          The fastest way to add SaaS & digital products to your stack
        </h1>
        <Link href="https://docs.polar.sh/documentation/tools/polar-init">
          <Button
            fullWidth
            wrapperClassNames="flex flex-row items-center gap-x-1"
            variant="secondary"
          >
            <span>Explore our tools</span>
            <KeyboardArrowRight className="text-lg" fontSize="inherit" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="dark:bg-polar-800 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-50 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <CommandLineIcon className="h-5 w-5" />
            <h1 className="text-xl">npx polar-init</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-500">
            Bootstrap products, subscriptions, checkouts & webhooks in your
            Next.js or Nuxt.js project.
          </p>
        </div>
        <div className="dark:bg-polar-800 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-50 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <CommandLineIcon className="h-5 w-5" />
            <h1 className="text-xl">npx polar-migrate</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-500">
            Migrate from LemonSqueezy to Polar in under a minute.
          </p>
        </div>
        <div className="dark:bg-polar-800 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-50 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <CommandLineIcon className="h-5 w-5" />
            <h1 className="text-xl">npx checkout-link</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-500">
            Sell any kind of file from your CLI with a single command.
          </p>
        </div>
      </div>
    </div>
  )
}
