export function cookieConsentGiven() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'undecided'
  }

  if (!localStorage.getItem('cookie_consent')) {
    return 'undecided'
  }

  return localStorage.getItem('cookie_consent')
}
