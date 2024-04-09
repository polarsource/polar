import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { RedirectType, redirect } from 'next/navigation'
import { DataTableSearchParams, parseSearchParams } from 'polarkit/datatable'
import ClientPage from './ClientPage'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Finance - Incoming`, // " | Polar is added by the template"
  }
}

export default async function Page({
  searchParams,
  params,
}: {
  searchParams: DataTableSearchParams
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup(
    {
      platform: Platforms.GITHUB,
      organizationName: params.organization,
    },
    cacheConfig,
  )
  if (organization.is_personal) {
    redirect('/finance/incoming', RedirectType.replace)
  }

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'created_at', desc: true },
  ])

  return (
    <ClientPage
      pagination={pagination}
      sorting={sorting}
      organization={organization}
    />
  )
}
