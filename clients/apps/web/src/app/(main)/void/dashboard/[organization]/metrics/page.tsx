import { VoidMetricsPage } from '@/components/Void/VoidMetricsPage'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Metrics' }

export default function Page() {
  return <VoidMetricsPage />
}
