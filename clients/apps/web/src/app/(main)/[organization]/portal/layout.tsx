import { Toaster } from '@/components/Toast/Toaster'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import { getBrowserLocale } from '@/utils/i18n'
import {
  type AcceptedLocale,
  DEFAULT_LOCALE,
  isAcceptedLocale,
} from '@polar-sh/i18n'
import { headers } from 'next/headers'
import { CustomerPortalLayoutWrapper } from './CustomerPortalLayoutWrapper'
import { Navigation } from './Navigation'

export const dynamic = 'force-dynamic'

async function getCustomerLocale(token: string): Promise<string | null> {
  const api = await getServerSideAPI(token)
  const { data: customer } = await api.GET('/v1/customer-portal/customers/me')
  return customer?.locale ?? null
}

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  let locale: AcceptedLocale = DEFAULT_LOCALE

  if (organization.organization_features?.checkout_localization_enabled) {
    const headersList = await headers()
    const portalSearchParams = new URLSearchParams(
      headersList.get('x-portal-search') ?? '',
    )

    const localeParam = portalSearchParams.get('locale')
    const overrideLocale =
      localeParam && isAcceptedLocale(localeParam) ? localeParam : null

    const token =
      portalSearchParams.get('customer_session_token') ??
      portalSearchParams.get('member_session_token') ??
      undefined

    const customerLocale =
      !overrideLocale && token ? await getCustomerLocale(token) : null

    const browserLocale = getBrowserLocale(headersList.get('accept-language'))

    if (overrideLocale) {
      locale = overrideLocale
    } else if (customerLocale && isAcceptedLocale(customerLocale)) {
      locale = customerLocale
    } else if (browserLocale) {
      locale = browserLocale
    }
  }

  return (
    <div className="flex min-h-screen grow flex-col">
      <CustomerPortalLayoutWrapper organization={organization} locale={locale}>
        <div className="flex w-full flex-col items-stretch gap-6 px-4 py-8 md:mx-auto md:max-w-5xl md:flex-row md:gap-12 lg:px-0">
          <Navigation organization={organization} />
          <div className="flex w-full flex-col md:py-12">{children}</div>
        </div>
      </CustomerPortalLayoutWrapper>
      <Toaster />
    </div>
  )
}
