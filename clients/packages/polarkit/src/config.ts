const stringToNumber = (
  value: string | undefined,
  fallback: number,
): number => {
  if (value === undefined) return fallback
  return parseInt(value)
}

/*
 * Keys sorted by their countries name in English.
 *
 * Generated list from Stripe console settings using:
 *
 * let whitelist = []
 * document.querySelectorAll('.PressableContext').forEach((d) => { if (d.checked && d.name !== '') { whitelist.push(d.name) } })
 * whitelist.join(',')
 *
 *
 * Alpha: EU, US, GB & CA.
 * Will expand to more Stripe countries in the near future.
 */
const STRIPE_COUNTRIES =
  'AT,BE,BG,CA,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,NO,PL,PT,RO,SK,SI,ES,SE,GB,US'

let defaults = {
  BASE_URL: process?.env?.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  GITHUB_APP_NAMESPACE:
    process?.env?.NEXT_PUBLIC_GITHUB_APP_NAMESPACE || 'polar-sh',
  LOCALSTORAGE_PERSIST_KEY:
    process?.env?.NEXT_PUBLIC_LOCALSTORAGE_PERSIST_KEY || 'polar',
  LOCALSTORAGE_PERSIST_VERSION: stringToNumber(
    process?.env?.NEXT_PUBLIC_LOCALSTORAGE_PERSIST_VERSION,
    3,
  ),
  GITHUB_EMBED_LABEL: process?.env?.NEXT_PUBLIC_GITHUB_EMBED_LABEL || 'polar',
  // Minimum amount in cents
  MINIMUM_PLEDGE_AMOUNT:
    process?.env?.NEXT_PUBLIC_MINIMUM_PLEDGE_AMOUNT || 2000,
  SENTRY_ENABLED: process?.env?.NEXT_PUBLIC_SENTRY_ENABLED || false,
  STRIPE_COUNTRIES_WHITELIST_CSV:
    process?.env?.NEXT_PUBLIC_STRIPE_COUNTRIES_WHITELIST || STRIPE_COUNTRIES,
}

export const CONFIG = {
  ...defaults,
  GITHUB_INSTALLATION_URL: `https://github.com/apps/${defaults.GITHUB_APP_NAMESPACE}/installations/new`,
}
