import { PortalLocaleProvider } from '@/components/CustomerPortal/PortalLocaleProvider'
import { getServerSideAPI } from '@/utils/client/serverside'
import { schemas } from '@polar-sh/client'
import { isAcceptedLocale } from '@polar-sh/i18n'
import { headers } from 'next/headers'
import { Navigation } from './Navigation'
import { resolvePortalLocale } from './resolveLocale'

async function getCustomerLocale(token: string): Promise<string | null> {
  const api = await getServerSideAPI(token)
  const { data: customer } = await api.GET('/v1/customer-portal/customers/me')
  return customer?.locale ?? null
}

export async function CustomerPortalPage({
  organization,
  searchParams,
  children,
}: {
  organization: schemas['CustomerOrganization']
  searchParams: {
    customer_session_token?: string
    member_session_token?: string
    locale?: string
  }
  children: React.ReactNode
}) {
  const token =
    searchParams.customer_session_token ?? searchParams.member_session_token

  const localizationEnabled =
    organization.organization_features?.checkout_localization_enabled ?? false

  const localeParam = searchParams.locale
  const hasOverride = Boolean(localeParam && isAcceptedLocale(localeParam))

  const customerLocale =
    localizationEnabled && !hasOverride && token
      ? await getCustomerLocale(token)
      : null

  const locale = resolvePortalLocale({
    localizationEnabled,
    localeParam,
    customerLocale,
    acceptLanguage: (await headers()).get('accept-language'),
  })

  return (
    <PortalLocaleProvider locale={locale}>
      <div className="flex w-full flex-col items-stretch gap-6 md:flex-row md:gap-12">
        <Navigation organization={organization} />
        <div className="flex w-full flex-col md:py-12">{children}</div>
      </div>
    </PortalLocaleProvider>
  )
}
