import { VoidMeterPage } from '@/components/Void/VoidMeterPage'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Meter' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <VoidMeterPage meterId={decodeURIComponent(id)} />
}
