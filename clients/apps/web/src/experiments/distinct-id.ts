import { nanoid } from 'nanoid'
import { cookies, headers } from 'next/headers'
import {
  COOKIE_MAX_AGE,
  DISTINCT_ID_COOKIE,
  DISTINCT_ID_HEADER,
} from './constants'

export async function getDistinctId(): Promise<string> {
  const headerStore = await headers()
  const headerDistinctId = headerStore.get(DISTINCT_ID_HEADER)
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
  const headerDistinctId = headerStore.get(DISTINCT_ID_HEADER)
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
