import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { Metadata } from 'next'
import VerifyPage from './VerifyPage'

export const metadata: Metadata = {
  title: 'Enter verification code',
}

export default async function Page(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const email = searchParams.email as string
  const return_to = searchParams.return_to as string | undefined
  const error = searchParams.error as string | undefined

  return (
    <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-white">
      <div className="flex w-80 flex-col items-center">
        <LogoIcon size={60} className="mb-6 text-black dark:text-white" />
        <div className="dark:text-polar-400 mb-2 text-center text-gray-500">
          We sent a verification code to{' '}
          <span className="dark:text-polar-300 font-medium text-gray-600">
            {email}
          </span>
        </div>
        <div className="dark:text-polar-400 mb-6 text-center text-sm text-gray-500">
          Please enter the 6-character code below
        </div>
        <VerifyPage return_to={return_to} error={error} email={email} />
      </div>
    </div>
  )
}
