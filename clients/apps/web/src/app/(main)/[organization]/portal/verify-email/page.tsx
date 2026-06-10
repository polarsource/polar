import { PortalLocaleProvider } from '@/components/CustomerPortal/PortalLocaleProvider'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { resolvePortalLocale } from '../resolveLocale'
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
    locale?: string
  }>
}) {
  const {
    customer_session_token,
    token,
    locale: localeParam,
    ...searchParams
  } = await props.searchParams
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

  const locale = resolvePortalLocale({
    localizationEnabled:
      organization.organization_features?.checkout_localization_enabled ??
      false,
    localeParam,
    acceptLanguage: (await headers()).get('accept-language'),
  })

  return (
    <PortalLocaleProvider locale={locale}>
      <VerifyEmailPage
        organization={organization}
        token={token}
        tokenValid={tokenValid}
      />
    </PortalLocaleProvider>
  )
}
