import {
  constants,
  generateKeyPairSync,
  type KeyObject,
  privateDecrypt,
  randomBytes,
} from 'node:crypto'
import { Context, Effect, Layer, Redacted } from 'effect'
import type {
  ActiveOrganization,
  AuthError,
  PolarEnvironment,
} from '@/schemas/Auth'
import { apiOrigin, dashboardOrigin } from '@/services/api'
import { tokenCopy } from '@/utils/callback-page'
import { awaitCallback, type CallbackResult } from '@/utils/loopback'

const CALLBACK_PATH = '/token/callback'

export const sdkHint = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    switch (environment) {
      case 'production':
        return []
      case 'sandbox':
        return [
          'The token only works on sandbox, and the Polar SDK calls production by default.',
          "Pass environment: 'sandbox' when you create the SDK client.",
        ]
      case 'local':
        return [
          'The token only works on your local server, and the Polar SDK calls production by default.',
          `Pass baseUrl: '${yield* apiOrigin('local')}' when you create the SDK client.`,
        ]
    }
  })

export interface TokenRequest {
  organization: Pick<ActiveOrganization, 'slug' | 'environment'>
  name: string
  scopes: ReadonlyArray<string>
}

export type AnnounceTokenPage = (page: URL) => Effect.Effect<void>

export class TokenHandoff extends Context.Service<
  TokenHandoff,
  {
    receive: (
      request: TokenRequest,
      announce: AnnounceTokenPage,
    ) => Effect.Effect<Redacted.Redacted<string>, AuthError>
  }
>()('TokenHandoff') {}

export const tokenPage = (
  origin: string,
  { organization, name, scopes }: TokenRequest,
  state: string,
  publicKey: string,
) => {
  const page = new URL(
    `/dashboard/${encodeURIComponent(organization.slug)}/cli/token`,
    origin,
  )
  page.search = new URLSearchParams({
    state,
    public_key: publicKey,
    name,
    ...(scopes.length > 0 ? { scopes: scopes.join(',') } : {}),
  }).toString()
  return page
}

export const parseHandoff = (
  url: URL,
  privateKey: KeyObject,
): CallbackResult<Redacted.Redacted<string>> => {
  if (url.searchParams.has('error')) {
    return {
      outcome: 'denied',
      message: 'Token creation was canceled. No token was created.',
    }
  }
  const encrypted = url.searchParams.get('encrypted_token')
  if (!encrypted) {
    return {
      outcome: 'invalid',
      message: 'Token callback is missing its token.',
    }
  }
  try {
    const token = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encrypted, 'base64url'),
    ).toString('utf8')
    return { outcome: 'success', value: Redacted.make(token) }
  } catch {
    return {
      outcome: 'invalid',
      message: 'Could not decrypt the token sent by the browser.',
    }
  }
}

const receive = (request: TokenRequest, announce: AnnounceTokenPage) =>
  Effect.gen(function* () {
    const state = randomBytes(32).toString('hex')
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const page = tokenPage(
      yield* dashboardOrigin(request.organization.environment),
      request,
      state,
      publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'),
    )
    yield* announce(page)
    return yield* awaitCallback({
      path: CALLBACK_PATH,
      state,
      target: page,
      parse: (url) => parseHandoff(url, privateKey),
      copy: tokenCopy,
      browserError: 'Could not open the browser to create the token.',
      timeoutError: 'Token creation timed out. Try again.',
    })
  })

export const layer = Layer.succeed(TokenHandoff, TokenHandoff.of({ receive }))
