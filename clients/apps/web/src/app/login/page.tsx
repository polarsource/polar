import Login from '@/components/Auth/Login'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login to Polar',
}

export default function Page({
  searchParams: { return_to },
}: {
  searchParams: { return_to: string }
}) {
  return <Login returnTo={return_to} />
}
