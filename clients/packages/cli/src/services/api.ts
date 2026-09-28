import { Context, Effect } from 'effect'
import { loginCommand, orgCommand, type PolarEnvironment } from '@/schemas/Auth'

type Env = Record<string, string | undefined>

export const Environment = Context.Reference<Env>('polar/Api/Environment', {
  defaultValue: () => process.env,
})

const API_ORIGINS = {
  production: 'https://api.polar.sh',
  sandbox: 'https://sandbox-api.polar.sh',
} as const

const isLoopback = (host: string) =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  host === '[::1]' ||
  /^127\.\d+\.\d+\.\d+$/.test(host)

const parseOverride = (value: string) => {
  const url = (() => {
    try {
      return new URL(value)
    } catch {
      return undefined
    }
  })()
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    return new Error(`POLAR_API_URL must be an http(s) URL, got "${value}"`)
  }
  if (url.protocol === 'http:' && !isLoopback(url.hostname)) {
    return new Error(
      `POLAR_API_URL must use https unless it points at localhost, got "${value}". Tokens would otherwise be sent in plain text.`,
    )
  }
  return url.origin
}

export const apiOrigin = (environment: PolarEnvironment) =>
  Effect.flatMap(Environment, (env) => {
    const override = env['POLAR_API_URL']?.trim()
    if (!override) return Effect.succeed(API_ORIGINS[environment])
    const parsed = parseOverride(override)
    return parsed instanceof Error ? Effect.die(parsed) : Effect.succeed(parsed)
  })

export const apiUrl = (environment: PolarEnvironment, path: string) =>
  Effect.map(apiOrigin(environment), (origin) => `${origin}/v1${path}`)

export interface ApiFailure {
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
