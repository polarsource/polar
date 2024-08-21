'use client'

import { ArrowForward } from '@mui/icons-material'
import GetStartedButton from '../Auth/GetStartedButton'

export const MerchantOfRecord = () => {
  return (
    <div className="grid grid-cols-1 gap-y-12 md:grid-cols-3 md:gap-x-16">
      <div className="rounded-4xl dark:bg-polar-900 relative col-span-1 flex w-full flex-col justify-between gap-y-8 p-10">
        <div className="flex w-full flex-col gap-y-8">
          <div className="flex w-full max-w-sm flex-col gap-y-6">
            <span className="dark:text-polar-400 font-mono text-xs uppercase tracking-wider">
              Merchant of Record
            </span>
            <h3 className="text-3xl font-medium leading-tight">
              Make money without the headaches
            </h3>
          </div>
          <ul className="dark:text-polar-200 flex flex-col gap-y-2">
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>Sales Tax & EU VAT handled</span>
            </li>
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>On-demand Payouts</span>
            </li>
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>Detailed Transactions Overview</span>
            </li>
          </ul>
        </div>
        <GetStartedButton />
      </div>
      <picture className="col-span-2">
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={`/assets/landing/transactions_dark.png`}
        />
        <img
          className="w-full rounded-2xl"
          srcSet={`/assets/landing/transactions_dark.png`}
          alt="Polar transactions view"
        />
      </picture>
    </div>
  )
}
