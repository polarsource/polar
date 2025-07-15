import Login from '@/components/Auth/Login'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log in to Polar',
}

export default async function Page({
  searchParams: { return_to, ...rest },
}: {
  searchParams: {
    return_to?: string
  }
}) {
  return (
    <div className="flex h-screen w-full grow items-center justify-center">
      <div className="rounded-4xl dark:bg-polar-900 flex w-full max-w-md flex-col justify-between gap-16 bg-gray-50 p-12">
        <div className="flex flex-col gap-y-8">
          <BrandingMenu logoVariant="icon" size={60} />
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl text-black dark:text-white">
              Welcome to Polar
            </h2>
            <h2 className="dark:text-polar-400 text-lg text-gray-500">
              The modern way to sell your SaaS and digital products
            </h2>
          </div>
        </div>
        <Login returnTo={return_to} returnParams={rest} />
      </div>
    </div>
  )
}
