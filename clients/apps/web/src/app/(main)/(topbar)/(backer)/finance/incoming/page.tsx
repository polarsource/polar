import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Finance - Incoming`, // " | Polar is added by the template"
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: DataTableSearchParams
}) {
  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'created_at', desc: true },
  ])

  return <ClientPage pagination={pagination} sorting={sorting} />
}
