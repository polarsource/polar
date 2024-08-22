import Login from '@/components/Auth/Login'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login to Polar',
}

export default async function Page({
  searchParams: { return_to, ...rest },
}: {
  searchParams: {
    return_to?: string
  }
}) {
  const restParams = new URLSearchParams(rest)
  const returnTo = return_to
    ? `${return_to || ''}?${restParams.toString()}`
    : undefined
  return (
    <div className="flex h-screen w-full grow items-center justify-center">
      <div className="flex w-full max-w-md flex-col justify-between gap-8 p-16">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl text-black dark:text-white">
              Welcome to Polar
            </h2>
            <h2 className="dark:text-polar-400 text-lg text-gray-500">
              The all-in-one funding & monetization platform for developers
            </h2>
          </div>
        </div>
        <Login returnTo={returnTo} />
      </div>
    </div>
  )
}
