const stringToNumber = (
  value: string | undefined,
  fallback: number,
): number => {
  if (value === undefined) return fallback
  return parseInt(value)
}

export const CONFIG = {
  BASE_URL: process?.env?.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  GITHUB_INSTALLATION_URL:
    process?.env?.NEXT_PUBLIC_GITHUB_INSTALLATION_URL ||
    'https://github.com/apps/polar-code/installations/new',
  LOCALSTORAGE_PERSIST_KEY:
    process?.env?.NEXT_PUBLIC_LOCALSTORAGE_PERSIST_KEY || 'polar',
  LOCALSTORAGE_PERSIST_VERSION: stringToNumber(
    process?.env?.NEXT_PUBLIC_LOCALSTORAGE_PERSIST_VERSION,
    3,
  ),
  // Minimum amount in cents
  MINIMUM_PLEDGE_AMOUNT:
    process?.env?.NEXT_PUBLIC_MINIMUM_PLEDGE_AMOUNT || 2000,
  SENTRY_ENABLED: process?.env?.NEXT_PUBLIC_SENTRY_ENABLED || false,
}
