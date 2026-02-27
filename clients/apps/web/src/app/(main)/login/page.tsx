import Login from '@/components/Auth/Login'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log in to Polar',
}

export default async function Page(props: {
  searchParams: Promise<{
    return_to?: string
  }>
}) {
  const searchParams = await props.searchParams

  const { return_to, ...rest } = searchParams

  return (
    <div className="flex h-screen w-full grow items-center justify-center">
      <div className="dark:bg-polar-900 flex w-full max-w-md flex-col justify-between gap-8 rounded-3xl bg-gray-50 p-12">
        <div className="flex flex-col gap-y-4">
          <PolarLogotype logoVariant="icon" size={60} />
          <div className="flex flex-col gap-4">
            {/* eslint-disable-next-line no-restricted-syntax */}
            <h2 className="text-2xl text-black dark:text-white">
              Welcome to Polar
            </h2>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <span className="dark:text-polar-400 text-lg text-balance text-gray-500">
              Monetize your software
            </span>
          </div>
        </div>
        <Login returnTo={return_to} returnParams={rest} />
      </div>
    </div>
  )
}
