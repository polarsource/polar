import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import {
  ArrowForward,
  FavoriteBorderOutlined,
  HiveOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import { Separator } from 'polarkit/components/ui/separator'
import { twMerge } from 'tailwind-merge'

export const UpsellFooter = ({ wide }: { wide?: boolean }) => {
  return (
    <>
      <div
        className={twMerge(
          'flex w-full flex-col items-start gap-x-32 gap-y-12 px-8 md:flex-row md:justify-between',
          wide ? 'max-w-7xl' : 'max-w-[970px]',
        )}
      >
        <div className="flex w-full flex-col gap-y-8 md:w-1/2">
          <LogoIcon className="h-10 w-10 text-blue-500 dark:text-blue-400" />
          <h1 className="text-4xl !font-light leading-normal">
            Turn your coding endeavors into a sustainable income
          </h1>
          <a
            className="flex flex-row items-center text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
            href="https://blog.polar.sh/polar-v1-0-lets-fix-open-source-funding/"
            target="_blank"
          >
            Learn more about our mission
            <ArrowUpRightIcon className="ml-2 h-5 w-5" fontSize="inherit" />
          </a>
        </div>
        <div className="mt-8 flex w-full flex-col gap-16 md:w-1/2 md:flex-row">
          <div className="flex flex-col gap-y-7 text-sm">
            <HiveOutlined className="text-blue-500 dark:text-blue-400" />
            <div className="flex flex-col gap-y-3">
              <h3 className="dark:text-polar-50 text-base font-medium text-gray-950">
                Maintainer
              </h3>
              <p className="dark:text-polar-400 leading-relaxed text-gray-500">
                Connect your GitHub repositories & embed the Polar funding-badge
                on your issues
              </p>
            </div>
            <Link
              className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              href="/signup/maintainer"
            >
              Become a Creator
              <ArrowForward className="ml-2" fontSize="inherit" />
            </Link>
          </div>
          <div className="flex flex-col gap-y-7 text-sm">
            <FavoriteBorderOutlined className="text-blue-500 dark:text-blue-400" />
            <div className="flex flex-col gap-y-3">
              <h3 className="dark:text-polar-50 text-base font-medium text-gray-950">
                Backer
              </h3>
              <p className="dark:text-polar-400 leading-relaxed text-gray-500">
                Fund issues in open source projects or receive rewards for your
                contributions
              </p>
            </div>
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
      <Separator className="dark:bg-polar-700 bg-gray-100" />
    </>
  )
}
