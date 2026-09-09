import type { PolarEnvironment } from '@/schemas/Auth'

const API_ORIGINS = {
  production: 'https://api.polar.sh',
  sandbox: 'https://sandbox-api.polar.sh',
} as const

export const apiOrigin = (environment: PolarEnvironment) =>
  process.env['POLAR_API_URL']?.replace(/\/$/, '') ?? API_ORIGINS[environment]

export const apiUrl = (environment: PolarEnvironment, path: string) =>
  `${apiOrigin(environment)}/v1${path}`
