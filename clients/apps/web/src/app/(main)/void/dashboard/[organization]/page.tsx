import { VoidHome } from '@/components/Void/VoidHome'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Home' }

export default function Page() {
  return <VoidHome />
}
