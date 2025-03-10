import { Metadata } from 'next'
import ClientPage from './ClientPage'

export const metadata: Metadata = {
  title: 'Magic link confirmation',
}

export default function Page({
  searchParams,
}: {
  searchParams: { token: string; return_to?: string }
}) {
  return <ClientPage searchParams={searchParams} />
}
