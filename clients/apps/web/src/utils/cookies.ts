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
): string | undefined => {
  return cookies.get(lastVisitedOrg)?.value
}
