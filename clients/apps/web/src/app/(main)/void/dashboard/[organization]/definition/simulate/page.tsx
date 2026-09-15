import { VoidSimulationList } from '@/components/Void/Simulation/VoidSimulationList'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Simulate' }

export default function Page() {
  return <VoidSimulationList />
}
