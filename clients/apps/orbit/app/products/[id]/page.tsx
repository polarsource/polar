import { notFound } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ProductDetail } from '@/components/ProductDetail'
import { findProduct } from '@/data/products'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = findProduct(id)
  if (!product) {
    notFound()
  }

  return (
    <AppShell>
      <ProductDetail product={product} />
    </AppShell>
  )
}
