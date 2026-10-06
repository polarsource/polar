import { VoidProductsPage } from '@/components/Void/VoidProductsPage'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Products' }

export default function Page() {
  return <VoidProductsPage />
}
