import { nanoid } from 'nanoid'
import { cookies } from 'next/headers'

const DISTINCT_ID_COOKIE = 'polar_distinct_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export async function getDistinctId(): Promise<string> {
  const cookieStore = await cookies()
  const existingId = cookieStore.get(DISTINCT_ID_COOKIE)?.value

  if (existingId) {
    return existingId
  }

  const newId = `anon_${nanoid()}`

  return newId
}

export async function getExistingDistinctId(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(DISTINCT_ID_COOKIE)?.value
}

export const distinctIdCookieConfig = {
  name: DISTINCT_ID_COOKIE,
  maxAge: COOKIE_MAX_AGE,
}
