import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Products', // " | Polar is added by the template"
  }
}

export default function Page({
  searchParams,
}: {
  searchParams: DataTableSearchParams & { query?: string }
}) {
  const { pagination, sorting } = parseSearchParams(
    searchParams,
    [{ id: 'name', desc: false }],
    10,
  )

  return (
    <ClientPage
      pagination={pagination}
      sorting={sorting}
      query={searchParams.query}
    />
  )
}
