export const defaultFrontendHostname = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_FRONTEND_BASE_URL).hostname
  : 'polar.sh'

export const defaultApiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.polar.sh'
