import { VoidProductPage } from '@/components/Void/VoidProductPage'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Product' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <VoidProductPage productId={id} />
}
