import { nanoid } from 'nanoid'
import { cookies, headers } from 'next/headers'

const DISTINCT_ID_COOKIE = 'spaire_distinct_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export async function getDistinctId(): Promise<string> {
  const headerStore = await headers()
  const headerDistinctId = headerStore.get('x-spaire-distinct-id')
  if (headerDistinctId) {
    return headerDistinctId
  }

  const cookieStore = await cookies()
  const cookieDistinctId = cookieStore.get(DISTINCT_ID_COOKIE)?.value
  if (cookieDistinctId) {
    return cookieDistinctId
  }

  return `anon_fallback_${nanoid()}`
}

export async function getExistingDistinctId(): Promise<string | undefined> {
  const headerStore = await headers()
  const headerDistinctId = headerStore.get('x-spaire-distinct-id')
  if (headerDistinctId) {
    return headerDistinctId
  }

  const cookieStore = await cookies()
  return cookieStore.get(DISTINCT_ID_COOKIE)?.value
}

export const distinctIdCookieConfig = {
  name: DISTINCT_ID_COOKIE,
  maxAge: COOKIE_MAX_AGE,
}
