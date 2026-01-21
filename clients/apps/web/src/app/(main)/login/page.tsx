import Login from '@/components/Auth/Login'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log in to Spaire',
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
      <div className="dark:bg-polar-900 flex w-full max-w-md flex-col justify-between gap-16 rounded-4xl bg-gray-50 p-12">
        <div className="flex flex-col gap-y-8">
          <PolarLogotype logoVariant="icon" size={60} />
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl text-black dark:text-white">
              Welcome back to Spaire
            </h2>
            <h2 className="dark:text-polar-400 text-lg text-gray-500">
              The financial backbone for SaaS selling worldwide
            </h2>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Login returnTo={return_to} returnParams={rest} />
          <p className="text-center text-sm text-gray-500 dark:text-polar-400">
            Don't have an account?{' '}
            <Link
              href="/signup"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
