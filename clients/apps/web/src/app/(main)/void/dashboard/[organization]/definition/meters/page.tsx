import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Meters' }

export default function Page() {
  return <DashboardBody title="Meters" />
}
