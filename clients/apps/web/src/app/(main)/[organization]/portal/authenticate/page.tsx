import { PortalLocaleProvider } from '@/components/CustomerPortal/PortalLocaleProvider'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { resolvePortalLocale } from '../resolveLocale'
import AuthenticatePage from './AuthenticatePage'

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
    title: `Customer Portal | ${organization.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `Customer Portal | ${organization.name} on Polar`,
      description: `Customer Portal | ${organization.name} on Polar`,
      siteName: 'Polar',
      type: 'website',
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${organization.name} on Polar`,
        },
      ],
      card: 'summary_large_image',
      title: `Customer Portal | ${organization.name} on Polar`,
      description: `Customer Portal | ${organization.name} on Polar`,
    },
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{ customer_session_token?: string; locale?: string }>
}) {
  const { customer_session_token, locale: localeParam, ...searchParams } =
    await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI(customer_session_token)
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
      <AuthenticatePage organization={organization} />
    </PortalLocaleProvider>
  )
}
