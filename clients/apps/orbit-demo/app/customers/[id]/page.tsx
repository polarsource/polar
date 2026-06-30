import { notFound } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { CustomerDetail } from '@/components/CustomerDetail'
import { findCustomer } from '@/data/customers'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const customer = findCustomer(id)
  if (!customer) {
    notFound()
  }

  return (
    <AppShell>
      <CustomerDetail customer={customer} />
    </AppShell>
  )
}
