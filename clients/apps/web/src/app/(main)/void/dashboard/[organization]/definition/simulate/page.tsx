import { SimulationListPage } from '@/components/Void/Simulation'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Simulate' }

export default function Page() {
  return <SimulationListPage />
}
