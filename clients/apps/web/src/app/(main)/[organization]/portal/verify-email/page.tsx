import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import VerifyEmailPage from './VerifyEmailPage'

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
    title: `Verify Email | ${organization.name}`,
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{
    customer_session_token?: string
    token?: string
  }>
}) {
  const { customer_session_token, token, ...searchParams } =
    await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI(customer_session_token)
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
    searchParams,
  )

  let tokenValid = false
  if (token) {
    const result = await api.GET(
      '/v1/customer-portal/customers/me/email-update/check',
      { params: { query: { token } } },
    )
    tokenValid = result.response.ok
  }

  return (
    <VerifyEmailPage
      organization={organization}
      token={token}
      tokenValid={tokenValid}
    />
  )
}
