import { PortalLocaleProvider } from '@/components/CustomerPortal/PortalLocaleProvider'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { resolvePortalLocale } from '../resolveLocale'
import ClaimPage from './ClaimPage'

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
    title: `Claim Your Seat | ${organization.name}`,
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{ token?: string; locale?: string }>
}) {
  const params = await props.params
  const { token, locale: localeParam, ...searchParams } =
    await props.searchParams

  // Get organization without requiring authentication (like /request page)
  const api = await getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
    searchParams,
  )

  const locale = resolvePortalLocale({
    localizationEnabled:
      organization.organization_features?.checkout_localization_enabled ??
      false,
    localeParam,
    acceptLanguage: (await headers()).get('accept-language'),
  })

  return (
    <PortalLocaleProvider locale={locale}>
      <ClaimPage organization={organization} invitationToken={token} />
    </PortalLocaleProvider>
  )
}
