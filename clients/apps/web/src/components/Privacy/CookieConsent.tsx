// app/banner.js
'use client'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'

export function cookieConsentGiven() {
  if (!localStorage.getItem('cookie_consent')) {
    return 'undecided'
  }

  return localStorage.getItem('cookie_consent')
}

export function CookieConsent() {
  const [consentGiven, setConsentGiven] = useState<string | null>('')
  const posthog = usePostHog()

  useEffect(() => {
    // We want this to only run once the client loads
    // or else it causes a hydration error
    setConsentGiven(cookieConsentGiven())
  }, [])

  useEffect(() => {
    if (consentGiven !== '') {
      posthog.set_config({
        persistence: consentGiven === 'yes' ? 'localStorage+cookie' : 'memory',
      })
    }
  }, [consentGiven])

  const handleAcceptCookies = () => {
    localStorage.setItem('cookie_consent', 'yes')
    setConsentGiven('yes')
  }

  const handleDeclineCookies = () => {
    localStorage.setItem('cookie_consent', 'no')
    setConsentGiven('no')
  }

  return (
    consentGiven === 'undecided' && (
      <div className="shadow-3xl dark:bg-polar-950 dark:border-polar-700 dark:text-polar-500 fixed bottom-8 left-8 right-8 z-50 flex flex-col gap-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500 md:left-auto md:max-w-96">
        <p>
          We use tracking cookies to understand how you use the product and help
          us improve it.
        </p>
        <div className="flex flex-row items-center gap-x-4">
          <button
            className="text-blue-500 dark:text-white"
            onClick={handleAcceptCookies}
            type="button"
          >
            Accept
          </button>
          <button onClick={handleDeclineCookies} type="button">
            Decline
          </button>
        </div>
      </div>
    )
  )
}
