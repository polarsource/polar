import { Metadata } from 'next'
import ClientPage from './ClientPage'

export const metadata: Metadata = {
  title: 'Subscriptions',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <ClientPage />
}
