import { getServerSideAPI } from '@/utils/client/serverside'
import { getBrowserLocale } from '@/utils/i18n'
import { schemas } from '@polar-sh/client'
import {
  type AcceptedLocale,
  DEFAULT_LOCALE,
  isAcceptedLocale,
} from '@polar-sh/i18n'
import { headers } from 'next/headers'
import { Navigation } from './Navigation'

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

  let locale: AcceptedLocale = DEFAULT_LOCALE

  if (localizationEnabled) {
    const localeParam = searchParams.locale
    const overrideLocale =
      localeParam && isAcceptedLocale(localeParam) ? localeParam : null

    const customerLocale =
      !overrideLocale && token ? await getCustomerLocale(token) : null

    const browserLocale = getBrowserLocale(
      (await headers()).get('accept-language'),
    )

    if (overrideLocale) {
      locale = overrideLocale
    } else if (customerLocale && isAcceptedLocale(customerLocale)) {
      locale = customerLocale
    } else if (browserLocale) {
      locale = browserLocale
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-6 md:flex-row md:gap-12">
      <Navigation
        organization={organization}
        locale={locale}
        localizationEnabled={localizationEnabled}
      />
      <div className="flex w-full flex-col md:py-12">{children}</div>
    </div>
  )
}
