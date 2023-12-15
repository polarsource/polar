import Login from '@/components/Auth/Login'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login to Polar',
}

export default function Page({
  searchParams: { goto_url },
}: {
  searchParams: { goto_url: string }
}) {
  return <Login gotoUrl={goto_url} />
}
