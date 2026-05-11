export type MintlifySearchResult = {
  content: string
  path: string
  metadata?: Record<string, unknown>
}

export type MintlifyPageContent = {
  path: string
  content: string
}

const SCORE_THRESHOLD = 0.5
const SEARCH_PAGE_SIZE = 10
const EXCLUDED_PATH_PREFIXES = ['changelog', 'guides']

export const MINTLIFY_DOMAIN =
  process.env.MINTLIFY_ASSISTANT_DOMAIN ?? 'polar.mintlify.app'

export const isExcludedPath = (path: string) => {
  const normalized = path.replace(/^\/+/, '').toLowerCase()
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}

export const dedupeByPath = (results: MintlifySearchResult[]) => {
  const seen = new Set<string>()
  const out: MintlifySearchResult[] = []
  for (const result of results) {
    if (!result?.path || seen.has(result.path)) continue
    if (isExcludedPath(result.path)) continue
    seen.add(result.path)
    out.push(result)
  }
  return out
}

const mintlifyPost = async <T>(
  apiKey: string,
  domain: string,
  endpoint: 'search' | 'page',
  body: Record<string, unknown>,
): Promise<T | null> => {
  try {
    const response = await fetch(
      `https://api.mintlify.com/discovery/v1/${endpoint}/${domain}`,
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
      console.error(
        `[feedback/question] Mintlify ${endpoint} ${response.status}`,
      )
      return null
    }
    return (await response.json()) as T
  } catch (error) {
    console.error(`[feedback/question] Mintlify ${endpoint} threw:`, error)
    return null
  }
}

export const searchMintlify = async (
  apiKey: string,
  domain: string,
  query: string,
): Promise<MintlifySearchResult[]> => {
  const data = await mintlifyPost<MintlifySearchResult[]>(
    apiKey,
    domain,
    'search',
    { query, scoreThreshold: SCORE_THRESHOLD, pageSize: SEARCH_PAGE_SIZE },
  )
  return Array.isArray(data) ? data : []
}

export const fetchMintlifyPageContent = async (
  apiKey: string,
  domain: string,
  path: string,
): Promise<MintlifyPageContent | null> => {
  const data = await mintlifyPost<MintlifyPageContent>(apiKey, domain, 'page', {
    path,
  })
  if (!data?.content || !data?.path) return null
  return data
}
