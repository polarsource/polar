import { EU_COUNTRY_CODES } from '@/components/Privacy/countries'

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

const CONSENT_DEFAULT = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500,
  region: EU_COUNTRY_CODES,
}

/**
 * Runs as a parse-time inline script so the default is queued before the
 * gtag loader, which Consent Mode requires. Visitors outside the listed
 * regions keep Google's implicit "granted" default.
 */
export const GOOGLE_ANALYTICS_CONSENT_DEFAULT_SCRIPT = `window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments)}gtag('consent','default',${JSON.stringify(CONSENT_DEFAULT)});`

export const updateGoogleAnalyticsConsent = (analyticsGranted: boolean) => {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  // gtag only recognises commands pushed as an `arguments` object, not an array.
  const gtag: (...args: unknown[]) => void = function () {
    // oxlint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments)
  }
  gtag('consent', 'update', {
    analytics_storage: analyticsGranted ? 'granted' : 'denied',
  })
}
