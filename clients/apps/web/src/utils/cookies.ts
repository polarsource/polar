import { schemas } from '@polar-sh/client'
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

const lastVisitedOrg = 'last_visited_org'
export const POLAR_ENV_COOKIE = 'polar_env'

export type PolarEnv = 'production' | 'sandbox'

export const setLastVisitedOrg = (
  organization: string,
  maxAge: number = 30 * 86400, // Expires in 30 days
) => {
  document.cookie = `${lastVisitedOrg}=${organization}; max-age=${maxAge}; path=/`
}

export const getLastVisitedOrg = (
  cookies: ReadonlyRequestCookies,
  organizations: schemas['Organization'][],
): schemas['Organization'] | undefined => {
  const lastVisitedOrgSlug = cookies.get(lastVisitedOrg)?.value
  if (!lastVisitedOrgSlug) {
    return undefined
  }
  return organizations.find((org) => org.slug === lastVisitedOrgSlug)
}

export const setLastVisitedEnv = (
  env: PolarEnv,
  maxAge: number = 30 * 60, // Expires in 30 minutes
) => {
  const hostname = window.location.hostname
  const domainAttr = hostname.endsWith('.polar.sh') ? '; domain=.polar.sh' : ''
  const secureAttr = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${POLAR_ENV_COOKIE}=${env}; max-age=${maxAge}; path=/; samesite=lax${domainAttr}${secureAttr}`
}
