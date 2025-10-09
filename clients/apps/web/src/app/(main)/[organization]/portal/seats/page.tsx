import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ClientPage from './ClientPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `Seat Management | ${organization.name}`,
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{
    customer_session_token?: string
    subscription_id?: string
  }>
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI(searchParams.customer_session_token)
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  // Fetch subscriptions to find seat-based ones
  const {
    data: subscriptions,
    error: subsError,
    response: subsResponse,
  } = await api.GET('/v1/customer-portal/subscriptions/', {
    params: {
      query: {
        active: true,
      },
    },
    cache: 'no-cache',
    next: {
      tags: [`customer_portal`],
    },
  })

  if (subsResponse.status === 401) {
    redirect(`/${organization.slug}/portal/request`)
  }

  if (subsError) {
    throw subsError
  }

  const seatBasedSubscriptions =
    subscriptions?.items?.filter((sub) =>
      sub.prices.some((price) => price.amount_type === 'seat_based'),
    ) || []

  return (
    <ClientPage
      subscriptions={seatBasedSubscriptions}
      customerSessionToken={searchParams.customer_session_token as string}
    />
  )
}
