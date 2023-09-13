import { Metadata } from 'next'
import { LogoType70 } from 'polarkit/components/brand'

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
    <div className="flex h-screen w-full grow items-center justify-center bg-[#FEFDF9] dark:bg-gray-950">
      <div id="polar-bg-gradient"></div>
      <div className="flex w-80 flex-col items-center">
        <LogoType70 className="mb-6 h-10" />
        <div className="text-center text-gray-500 dark:text-gray-400">
          Email with sign in link sent to{' '}
          <span className="font-bold">{email}</span>.
        </div>
        <div className="text-center text-gray-500 dark:text-gray-400">
          If no account exists, it will be created.
        </div>
      </div>
    </div>
  )
}
