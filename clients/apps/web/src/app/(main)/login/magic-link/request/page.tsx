import LogoIcon from '@/components/Brand/LogoIcon'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in link sent',
}

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const email = searchParams.email
  return (
    <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-gray-50">
      <div id="polar-bg-gradient"></div>
      <div className="flex w-80 flex-col items-center">
        <LogoIcon size={60} className="mb-6 text-blue-500 dark:text-blue-400" />
        <div className="dark:text-polar-400 text-center text-gray-500">
          Email with sign in link sent to{' '}
          <span className="font-bold">{email}</span>.
        </div>
        <div className="dark:text-polar-400 text-center text-gray-500">
          An account will be created unless one already exists.
        </div>
      </div>
    </div>
  )
}
