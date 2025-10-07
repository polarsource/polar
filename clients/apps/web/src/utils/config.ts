const stringToNumber = (
  value: string | undefined,
  fallback: number,
): number => {
  if (value === undefined) return fallback
  return parseInt(value)
}

const defaults = {
  ENVIRONMENT:
    process.env.NEXT_PUBLIC_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    'development',
  FRONTEND_BASE_URL:
    process.env.NEXT_PUBLIC_FRONTEND_BASE_URL || 'http://127.0.0.1:3000',
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  AUTH_COOKIE_KEY: process.env.POLAR_AUTH_COOKIE_KEY || 'polar_session',
  AUTH_MCP_COOKIE_KEY:
    process.env.POLAR_AUTH_MCP_COOKIE_KEY || 'polar_mcp_session',
  LOGIN_PATH: process.env.NEXT_PUBLIC_LOGIN_PATH || '/login',
  GOOGLE_ANALYTICS_ID: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || undefined,
  GITHUB_APP_NAMESPACE:
    process.env.NEXT_PUBLIC_GITHUB_APP_NAMESPACE || 'polar-sh',
  GITHUB_BADGE_EMBED_DEFAULT_LABEL:
    process.env.NEXT_PUBLIC_GITHUB_BADGE_EMBED_DEFAULT_LABEL || 'Fund',
  SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  POSTHOG_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_TOKEN || '',
  APPLE_DOMAIN_ASSOCIATION:
    process.env.NEXT_PUBLIC_APPLE_DOMAIN_ASSOCIATION ||
    '<Replace with Apple Pay Domain Association from Stripe>',
  CHECKOUT_EMBED_SCRIPT_SRC:
    process.env.NEXT_PUBLIC_CHECKOUT_EMBED_SCRIPT_SRC ||
    'node_modules/@polar-sh/checkout/dist/embed.global.js',
  CHECKOUT_EXTERNAL_WEBHOOKS_WAITING_LIMIT_MS: stringToNumber(
    process.env.NEXT_PUBLIC_CHECKOUT_EXTERNAL_WEBHOOKS_WAITING_LIMIT_MS,
    30000,
  ),
}

export const CONFIG = {
  ...defaults,
  GITHUB_INSTALLATION_URL: `https://github.com/apps/${defaults.GITHUB_APP_NAMESPACE}/installations/new`,
  IS_SANDBOX: defaults.ENVIRONMENT === 'sandbox',
}
