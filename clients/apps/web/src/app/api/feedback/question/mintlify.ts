import * as Sentry from '@sentry/nextjs'

export type MintlifySearchResult = {
  content: string
  path: string
  metadata?: Record<string, unknown>
}

export type MintlifyPageContent = {
  path: string
  content: string
}

const MINTLIFY_DOMAIN = 'polar'

const EXCLUDED_PATH_PREFIXES = ['changelog', 'guides']

const isExcludedPath = (path: string) => {
  const normalized = path.replace(/^\/+/, '').toLowerCase()
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}

const mintlifyPost = async <T>(
  apiKey: string,
  endpoint: 'search' | 'page',
  body: Record<string, unknown>,
): Promise<T | null> => {
  try {
    const response = await fetch(
      `https://api.mintlify.com/discovery/v1/${endpoint}/${MINTLIFY_DOMAIN}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      Sentry.captureMessage(
        `Mintlify ${endpoint} request failed with ${response.status}`,
        { level: 'error', tags: { endpoint, status: response.status } },
      )
      return null
    }
    return (await response.json()) as T
  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint } })
    return null
  }
}

export const searchMintlify = async (
  apiKey: string,
  query: string,
): Promise<MintlifySearchResult[]> => {
  const data = await mintlifyPost<MintlifySearchResult[]>(apiKey, 'search', {
    query,
    scoreThreshold: 0.6,
    pageSize: 10,
  })
  if (!Array.isArray(data)) return []
  return data.filter((result) => result?.path && !isExcludedPath(result.path))
}

export const fetchMintlifyPageContent = async (
  apiKey: string,
  path: string,
): Promise<MintlifyPageContent | null> => {
  const data = await mintlifyPost<MintlifyPageContent>(apiKey, 'page', {
    path,
  })
  if (!data?.content || !data?.path) return null
  return data
}
