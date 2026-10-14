import { Context, Effect } from 'effect'
import { HttpClientRequest } from 'effect/http'
import { loginCommand, orgCommand, type PolarEnvironment } from '@/schemas/Auth'

type Env = Record<string, string | undefined>

export const Environment = Context.Reference<Env>('polar/Api/Environment', {
  defaultValue: () => process.env,
})

export const UsedEnvironments = Context.Reference<Set<PolarEnvironment>>(
  'polar/Api/UsedEnvironments',
  { defaultValue: () => new Set() },
)

const API_ORIGINS = {
  production: 'https://api.polar.sh',
  sandbox: 'https://sandbox-api.polar.sh',
  local: 'http://127.0.0.1:8000',
} as const

const isLoopback = (host: string) =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  host === '[::1]' ||
  /^127\.\d+\.\d+\.\d+$/.test(host)

const parseOverride = (name: string, value: string) => {
  const url = (() => {
    try {
      return new URL(value)
    } catch {
      return undefined
    }
  })()
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    return new Error(`${name} must be an http(s) URL, got "${value}"`)
  }
  if (url.protocol === 'http:' && !isLoopback(url.hostname)) {
    return new Error(
      `${name} must use https unless it points at localhost, got "${value}". Tokens would otherwise be sent in plain text.`,
    )
  }
  return url.origin
}

const originOverride = (name: string) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const value = env[name]?.trim()
    if (!value) return undefined
    const parsed = parseOverride(name, value)
    return parsed instanceof Error ? yield* Effect.die(parsed) : parsed
  })

export const apiOverride = originOverride('POLAR_API_URL')

export const dashboardOverride = originOverride('POLAR_DASHBOARD_URL')

export const apiOrigin = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const used = yield* UsedEnvironments
    used.add(environment)
    return (yield* apiOverride) ?? API_ORIGINS[environment]
  })

export const apiUrl = (environment: PolarEnvironment, path: string) =>
  Effect.map(apiOrigin(environment), (origin) => `${origin}/v1${path}`)

export const withOrganization = (organizationId: string) =>
  HttpClientRequest.setHeader('Polar-Organization', organizationId)

interface ApiFailure {
  message: string
  hint?: string
}

export const describeApiFailure = (
  status: number,
  environment: PolarEnvironment,
): ApiFailure => {
  switch (status) {
    case 401:
      return {
        message: `Authentication rejected for ${environment}`,
        hint: `Check POLAR_ACCESS_TOKEN or run ${loginCommand(environment)} --new-session`,
      }
    case 403:
      return {
        message: 'You do not have access to this organization',
        hint: 'The token needs the webhooks:read and webhooks:write scopes',
      }
    case 404:
      return {
        message: `The organization could not be found in ${environment}`,
        hint: `Check --org or run ${orgCommand} to pick another one`,
      }
    default:
      return status >= 500
        ? {
            message: `The Polar API returned an error (${status})`,
            hint: 'It may be having issues, try again shortly',
          }
        : { message: `The API returned an unexpected status (${status})` }
  }
}
