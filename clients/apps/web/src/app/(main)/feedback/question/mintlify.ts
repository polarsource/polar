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

export const searchMintlify = async (
  apiKey: string,
  domain: string,
  query: string,
): Promise<MintlifySearchResult[]> => {
  try {
    const response = await fetch(
      `https://api.mintlify.com/discovery/v1/search/${domain}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          scoreThreshold: SCORE_THRESHOLD,
          pageSize: SEARCH_PAGE_SIZE,
        }),
      },
    )
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(
        `[feedback/question] Mintlify search ${response.status} for "${query}": ${text.slice(0, 300)}`,
      )
      return []
    }
    const data = (await response.json()) as MintlifySearchResult[]
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('[feedback/question] Mintlify search threw:', error)
    return []
  }
}

export const fetchMintlifyPageContent = async (
  apiKey: string,
  domain: string,
  path: string,
): Promise<MintlifyPageContent | null> => {
  try {
    const response = await fetch(
      `https://api.mintlify.com/discovery/v1/page/${domain}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      },
    )
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(
        `[feedback/question] Mintlify page ${response.status} for "${path}": ${text.slice(0, 300)}`,
      )
      return null
    }
    const data = (await response.json()) as MintlifyPageContent
    if (!data?.content || !data?.path) return null
    return data
  } catch (error) {
    console.error('[feedback/question] Mintlify page fetch threw:', error)
    return null
  }
}
