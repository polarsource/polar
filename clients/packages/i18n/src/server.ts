/**
 * Parse Accept-Language header and return the best matching locale.
 * Returns null if no supported locale is found.
 *
 * @example
 * // Backend usage for priority step 4
 * const locale = detectLocaleFromHeader(
 *   request.headers['accept-language'],
 *   merchant.supportedLocales
 * )
 */
export function detectLocaleFromHeader(
  acceptLanguage: string | null,
  supportedLocales: string[]
): string | null {
  if (!acceptLanguage || supportedLocales.length === 0) return null

  const preferred = acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0].trim().split('-')[0])
    .find((lang) => supportedLocales.includes(lang))

  return preferred ?? null
}
