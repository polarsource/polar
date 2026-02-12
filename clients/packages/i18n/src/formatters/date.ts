import { DEFAULT_LOCALE, type AcceptedLocale } from '../config'

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatCacheKey(
  locale: AcceptedLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  const sorted = Object.keys(options)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = options[k as keyof typeof options]
      return acc
    }, {})
  return `${locale}:${JSON.stringify(sorted)}`
}

function getDateFormatter(
  locale: AcceptedLocale,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const opts = options ?? { dateStyle: 'medium' as const }
  const key = formatCacheKey(locale, opts)
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts)
    formatterCache.set(key, fmt)
  }
  return fmt
}

export function formatDate(
  date: Date | string,
  locale: AcceptedLocale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return getDateFormatter(locale, options).format(d)
}
