'use client'

import { ArrowForward } from '@mui/icons-material'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'

export const MerchantOfRecord = () => {
  return (
    <div className="grid grid-cols-1 gap-y-12 md:grid-cols-3 md:gap-x-16">
      <picture className="col-span-2">
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={`/assets/landing/transactions_dark.png`}
        />
        <img
          className="shadow-3xl w-full rounded-2xl"
          srcSet={`/assets/landing/transactions_light.png`}
          alt="Polar transactions view"
        />
      </picture>
      <div className="rounded-4xl dark:bg-polar-900 relative col-span-1 flex w-full flex-col justify-between gap-y-8 bg-gray-50 p-10">
        <div className="flex w-full flex-col gap-y-8">
          <div className="flex w-full max-w-sm flex-col gap-y-6">
            <h3 className="text-3xl font-medium leading-tight">
              Leave upsales, billing and international taxes to us
            </h3>
          </div>
          <ul className="dark:text-polar-200 flex flex-col gap-y-2">
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>Polar as Merchant of Record</span>
            </li>
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>US Sales Tax & EU VAT handled</span>
            </li>
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <Link href="/docs/merchant-of-record/tax" className="underline">
                Read more
              </Link>
            </li>
          </ul>
        </div>
        <GetStartedButton />
      </div>
    </div>
  )
}
