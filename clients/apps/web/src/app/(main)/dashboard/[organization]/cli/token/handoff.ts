import { enums, type schemas } from '@polar-sh/client'

const CLI_CALLBACK_URL = 'http://127.0.0.1:3333/token/callback'

export interface CLIHandoff {
  state: string
  publicKey: string
}

export const getCLIHandoff = (
  searchParams: URLSearchParams,
): CLIHandoff | null => {
  const state = searchParams.get('state')
  const publicKey = searchParams.get('public_key')
  return state && publicKey ? { state, publicKey } : null
}

export const getRequestedScopes = (searchParams: URLSearchParams) => {
  const requested = new Set(searchParams.get('scopes')?.split(',') ?? [])
  return enums.availableScopeValues.filter((scope) => requested.has(scope))
}

const fromBase64Url = (value: string) =>
  Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (character) => character.charCodeAt(0),
  )

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export const encryptForCLI = async (publicKey: string, token: string) => {
  const key = await crypto.subtle.importKey(
    'spki',
    fromBase64Url(publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(token),
  )
  return toBase64Url(encrypted)
}

const callbackURL = (params: Record<string, string>) =>
  `${CLI_CALLBACK_URL}?${new URLSearchParams(params).toString()}`

export const getCLITokenURL = async (
  { state, publicKey }: CLIHandoff,
  created: schemas['OrganizationAccessTokenCreateResponse'],
) =>
  callbackURL({
    state,
    encrypted_token: await encryptForCLI(publicKey, created.token),
  })

export const getCLICancelURL = ({ state }: CLIHandoff) =>
  callbackURL({ state, error: 'access_denied' })
