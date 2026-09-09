import type { PolarEnvironment } from '@/schemas/Auth'

export const API_BASE_URLS = {
  production: 'https://api.polar.sh/v1',
  sandbox: 'https://sandbox-api.polar.sh/v1',
} as const

export const apiUrl = (environment: PolarEnvironment, path: string) =>
  `${API_BASE_URLS[environment]}${path}`
