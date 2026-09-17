import { VoidEventsPage } from '@/components/Void/VoidEventsPage'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Events' }

export default function Page() {
  return <VoidEventsPage />
}
