'use client'

import { CommandLineIcon } from '@heroicons/react/24/outline'
import { ShoppingBagOutlined } from '@mui/icons-material'
import Link from 'next/link'

export const Intro = () => {
  return (
    <div className="flex flex-col items-center space-y-16">
      <h1 className="text-pretty text-center text-4xl md:text-5xl">
        Payments infrastructure{' '}
        <span className="dark:text-polar-500 text-gray-400">for everyone</span>
      </h1>

      <div className="dark:border-polar-700 hover:dark:border-polar-600 dark:divide-polar-700 rounded-4xl grid divide-y divide-gray-200 border border-gray-200 bg-white md:grid-cols-2 md:divide-x md:divide-y-0 dark:bg-transparent">
        <Link
          href="/docs"
          className="group flex cursor-pointer flex-col gap-y-8 p-12 transition-all"
        >
          <CommandLineIcon className="h-8 w-8" />
          <div className="flex flex-col gap-y-4">
            <h2 className="text-3xl">
              Integrate Polar{' '}
              <span className="dark:text-polar-500 text-gray-400">
                using our API
              </span>
            </h2>
            <p className="dark:text-polar-500 text-xl text-gray-500">
              Developer experience is our top priority. That&apos;s why Polar is
              built API-first.
            </p>
          </div>
          <span className="dark:text-polar-500 inline-flex items-center gap-x-1 transition-opacity group-hover:text-blue-500 dark:group-hover:text-white">
            Build with Polar
            <span className="transform transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </Link>

        <Link
          href="/docs/checkout"
          className="group flex cursor-pointer flex-col gap-y-8 p-12 transition-all"
        >
          <ShoppingBagOutlined className="h-8 w-8" />
          <div className="flex flex-col gap-y-4">
            <h2 className="text-3xl">
              Supercharged{' '}
              <span className="dark:text-polar-500 text-gray-400">
                Checkouts
              </span>
            </h2>
            <p className="dark:text-polar-500 text-xl text-gray-500">
              Add the best checkout experience on the market using our Checkout
              Embeds.
            </p>
          </div>
          <span className="dark:text-polar-500 inline-flex items-center gap-x-1 transition-colors group-hover:text-blue-500 dark:group-hover:text-white">
            Add Checkouts
            <span className="ml-2 transform transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </Link>
      </div>
    </div>
  )
}
