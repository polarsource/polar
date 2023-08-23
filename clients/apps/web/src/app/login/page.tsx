import Login from '@/components/Auth/Login'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login to Polar',
}

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const gotoUrl =
    typeof searchParams['goto_url'] === 'string'
      ? searchParams['goto_url']
      : '/login/init'
  return <Login gotoUrl={gotoUrl} />
}
