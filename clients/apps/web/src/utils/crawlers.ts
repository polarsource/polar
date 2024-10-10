import crawlers from 'crawler-user-agents'

const CRAWLER_USER_AGENTS_REGEXP = new RegExp(
  crawlers.map((i) => i.pattern).join('|'),
  'i',
)

export const isCrawler = (userAgent: string): boolean => {
  return CRAWLER_USER_AGENTS_REGEXP.test(userAgent)
}
