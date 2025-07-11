import LogoIcon from '@/components/Brand/LogoIcon'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export const metadata: Metadata = {
  title: 'Enter verification code',
}

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const email = searchParams.email as string
  const returnTo = searchParams.return_to as string | undefined
  
  return (
    <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-gray-50">
      <div id="polar-bg-gradient"></div>
      <div className="flex w-80 flex-col items-center">
        <LogoIcon size={60} className="mb-6 text-blue-500 dark:text-blue-400" />
        <div className="dark:text-polar-400 text-center text-gray-500 mb-2">
          We sent a verification code to{' '}
          <span className="font-bold">{email}</span>
        </div>
        <div className="dark:text-polar-400 text-center text-gray-500 text-sm mb-6">
          Please enter the 6-character code below
        </div>
        <ClientPage returnTo={returnTo} />
      </div>
    </div>
  )
}