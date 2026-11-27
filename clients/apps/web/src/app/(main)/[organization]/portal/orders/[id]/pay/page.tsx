import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import { unwrap } from '@polar-sh/client'
import { notFound, redirect } from 'next/navigation'
import PayPage from './PayPage'

export { generateMetadata } from '../page'

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
  searchParams: Promise<{
    customer_session_token?: string
    member_session_token?: string
    locale?: string
  }>
}) {
  const resolvedSearchParams = await props.searchParams
  const { customer_session_token, member_session_token, ...searchParams } =
    resolvedSearchParams
  const params = await props.params
  const token = customer_session_token ?? member_session_token
  const api = await getServerSideAPI(token)
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
    searchParams,
  )

  const order = await unwrap(
    api.GET('/v1/customer-portal/orders/{id}', {
      params: { path: { id: params.id } },
      cache: 'no-cache',
      next: { tags: [`customer_portal`] },
    }),
    {
      404: notFound,
      422: notFound,
      // Sign in, then come back to pay
      401: () =>
        redirect(
          `/${organization.slug}/portal/request?${new URLSearchParams({
            ...searchParams,
            return_to: `/${organization.slug}/portal/orders/${params.id}/pay`,
          })}`,
        ),
      403: () =>
        redirect(
          `/${organization.slug}/portal?${new URLSearchParams(resolvedSearchParams)}`,
        ),
    },
  )

  return (
    <PayPage
      organization={organization}
      order={order}
      customerSessionToken={token as string}
    />
  )
}
