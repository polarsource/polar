'use client'

import { useAuth } from '@/hooks'
import {
  ArrowForward,
  FavoriteBorderOutlined,
  HiveOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { Separator } from 'polarkit/components/ui/separator'
import { twMerge } from 'tailwind-merge'

export const UpsellFooter = ({ wide }: { wide?: boolean }) => {
  const { currentUser } = useAuth()

  if (!!currentUser) {
    return null
  }

  return (
    <>
      <div
        className={twMerge(
          'flex w-full flex-col items-start gap-x-24 gap-y-12 px-8 md:flex-row md:justify-between',
          wide ? 'max-w-7xl' : 'max-w-[970px]',
        )}
      >
        <div className="flex w-full flex-col md:w-1/2 md:flex-row">
          <h1 className="text-4xl leading-normal">
            Your open source projects deserve more than just recognition
          </h1>
        </div>
        <div className="flex w-full flex-col gap-16 md:w-1/2 md:flex-row">
          <div className="flex flex-col gap-y-4 text-sm">
            <HiveOutlined className="text-blue-500 dark:text-blue-400" />
            <h3 className="dark:text-polar-50 text-base font-medium text-gray-950">
              Maintainer
            </h3>
            <p className="dark:text-polar-400 leading-relaxed text-gray-500">
              Connect your GitHub repositories & embed the Polar funding-badge
              on your issues
            </p>
            <Link
              className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              href="/signup/maintainer"
            >
              Become a Maintainer
              <ArrowForward className="ml-2" fontSize="inherit" />
            </Link>
          </div>
          <div className="flex flex-col gap-y-4 text-sm">
            <FavoriteBorderOutlined className="text-blue-500 dark:text-blue-400" />
            <h3 className="dark:text-polar-50 text-base font-medium text-gray-950">
              Backer
            </h3>
            <p className="dark:text-polar-400 leading-relaxed text-gray-500">
              Fund issues in open source projects or receive rewards for your
              contributions
            </p>
            <Link
              className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              href="/login"
            >
              Become a Backer
              <ArrowForward className="ml-2" fontSize="inherit" />
            </Link>
          </div>
        </div>
      </div>
      <Separator />
    </>
  )
}
