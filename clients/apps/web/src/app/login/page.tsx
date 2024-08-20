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
  return <Login returnTo={returnTo} />
}
