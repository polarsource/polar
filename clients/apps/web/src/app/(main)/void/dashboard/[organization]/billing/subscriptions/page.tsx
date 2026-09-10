import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Subscriptions' }

export default function Page() {
  return <DashboardBody title="Subscriptions" />
}
