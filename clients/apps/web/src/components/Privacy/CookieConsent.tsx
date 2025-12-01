// app/banner.js
'use client'
import { EU_COUNTRY_CODES } from '@/components/Privacy/countries'
import { usePostHog } from '@/hooks/posthog'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export function cookieConsentGiven() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'undecided'
  }

  if (!localStorage.getItem('cookie_consent')) {
    return 'undecided'
  }

  return localStorage.getItem('cookie_consent')
}

export function CookieConsent({ countryCode }: { countryCode: string | null }) {
  const isEU = countryCode ? EU_COUNTRY_CODES.includes(countryCode) : false
  const [consentGiven, setConsentGiven] = useState<string | null>('')
  const { setPersistence } = usePostHog()
  const searchParams = useSearchParams()

  let doNotTrackParameter = searchParams.get('do_not_track')

  // The do_not_track parameter can be passed in the query params or in the return_to parameter
  if (!doNotTrackParameter) {
    const returnTo = searchParams.get('return_to')
    if (returnTo) {
      try {
        const returnToUrl = new URL(returnTo, window.location.origin)
        doNotTrackParameter = returnToUrl.searchParams.get('do_not_track')
      } catch {
        // No parameter found, nothing to do
      }
    }
  }

  const declineCookies = useCallback(() => {
    localStorage.setItem('cookie_consent', 'no')
    setConsentGiven('no')
  }, [setConsentGiven])

  useEffect(() => {
    // We want this to only run once the client loads
    // or else it causes a hydration error
    const currentConsent = cookieConsentGiven()

    if (doNotTrackParameter && currentConsent === 'undecided') {
      declineCookies()
    } else {
      setConsentGiven(currentConsent)
    }
  }, [declineCookies, doNotTrackParameter])

  useEffect(() => {
    if (consentGiven !== '') {
      setPersistence(consentGiven === 'yes' ? 'localStorage' : 'memory')
    }
  }, [consentGiven, setPersistence])

  const handleAcceptCookies = () => {
    localStorage.setItem('cookie_consent', 'yes')
    setConsentGiven('yes')
  }

  const handleDeclineCookies = () => {
    declineCookies()
  }

  if (!isEU || doNotTrackParameter) {
    return null
  }

  return (
    consentGiven === 'undecided' && (
      <div className="shadow-3xl dark:bg-polar-950 dark:border-polar-700 dark:text-polar-500 fixed right-8 bottom-8 left-8 z-50 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 md:left-auto md:max-w-96">
        <p>
          We use tracking cookies to understand how you use the product and help
          us improve it.
        </p>
        <div className="flex flex-row items-center gap-x-4">
          <button
            className="cursor-pointer text-blue-500 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-gray-200"
            onClick={handleAcceptCookies}
            type="button"
          >
            Accept
          </button>
          <button
            className="cursor-pointer text-gray-500 transition-colors hover:text-gray-600 dark:hover:text-gray-600"
            onClick={handleDeclineCookies}
            type="button"
          >
            Decline
          </button>
        </div>
      </div>
    )
  )
}
