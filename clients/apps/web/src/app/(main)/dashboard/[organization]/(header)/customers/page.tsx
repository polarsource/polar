import { CustomersOverview } from '@/components/Customer/CustomersOverview'
import { EmptyState } from '@/components/Shared/EmptyState'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Users } from 'lucide-react'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Customers', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { data } = await api.GET('/v1/customers/', {
    params: {
      query: {
        organization_id: organization.id,
        limit: 1,
      },
    },
  })

  if (!data?.items || data.items.length === 0) {
    return (
      <div className="flex h-full w-full flex-col justify-center">
        <EmptyState
          icon={<Users />}
          title="No Customers"
          description="Create a customer to get started."
        />
      </div>
    )
  }

  return <CustomersOverview organization={organization} />
}
