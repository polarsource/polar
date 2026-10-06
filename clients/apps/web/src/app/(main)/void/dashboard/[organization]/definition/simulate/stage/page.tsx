import { VoidStagePage } from '@/components/Void/Stage/VoidStagePage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Review staged changes' }

export default function Page() {
  return <VoidStagePage />
}
