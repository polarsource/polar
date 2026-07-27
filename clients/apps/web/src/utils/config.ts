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
  GOOGLE_ANALYTICS_ID: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || undefined,
  SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  POSTHOG_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_TOKEN || '',
  APPLE_DOMAIN_ASSOCIATION:
    process.env.NEXT_PUBLIC_APPLE_DOMAIN_ASSOCIATION ||
    '<Replace with Apple Pay Domain Association from Stripe>',
  SANDBOX_FRONTEND_BASE_URL:
    process.env.NEXT_PUBLIC_SANDBOX_FRONTEND_BASE_URL ||
    'http://127.0.0.1:3000',
  CHECKOUT_EMBED_SCRIPT_SRC:
    process.env.NEXT_PUBLIC_CHECKOUT_EMBED_SCRIPT_SRC ||
    'node_modules/@polar-sh/checkout/dist/embed.global.js',
}

export const CONFIG = {
  ...defaults,
  IS_SANDBOX: defaults.ENVIRONMENT === 'sandbox',
}
