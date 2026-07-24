import { getServerSideAPI } from '@/utils/client/serverside'
import { getBrowserLocale } from '@/utils/i18n'
import { schemas } from '@polar-sh/client'
import {
  type AcceptedLocale,
  DEFAULT_LOCALE,
  isAcceptedLocale,
} from '@polar-sh/i18n'
import { Box } from '@polar-sh/orbit/Box'
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
    <Box
      width="100%"
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems="stretch"
      gap={{ base: 'xl', md: '3xl' }}
    >
      <Navigation
        organization={organization}
        locale={locale}
        localizationEnabled={localizationEnabled}
      />
      <Box
        width="100%"
        flexDirection="column"
        paddingVertical={{ base: 'none', md: '3xl' }}
      >
        {children}
      </Box>
    </Box>
  )
}
