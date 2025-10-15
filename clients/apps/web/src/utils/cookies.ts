import { schemas } from '@polar-sh/client'
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

const lastVisitedOrg = 'last_visited_org'

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
