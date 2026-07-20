import { schemas } from '@polar-sh/client'

export type SSOProviderPreset = 'google' | 'custom'

export const GOOGLE_ISSUER = 'https://accounts.google.com'
export const WORKSPACE_DOMAIN_PARAMETER = 'hd'

export const SSO_PROVIDER_PRESETS: {
  value: SSOProviderPreset
  label: string
}[] = [
  { value: 'google', label: 'Google Workspace' },
  { value: 'custom', label: 'Custom OIDC provider' },
]

export interface SSOConnectionFormValues {
  name: string
  issuer: string
  client_id: string
  auth_method: 'client_secret' | 'private_key_jwt'
  client_secret: string
  authorization_parameters: { key: string; value: string }[]
}

export type SSOConnectionConfiguration =
  schemas['OrganizationSSOConnectionCreate']['configuration']

export const toConfiguration = (
  values: SSOConnectionFormValues,
): SSOConnectionConfiguration => {
  const authorization_parameters = Object.fromEntries(
    values.authorization_parameters
      .map(({ key, value }) => [key.trim(), value.trim()] as const)
      .filter(([key, value]) => key !== '' && value !== ''),
  )

  return values.auth_method === 'private_key_jwt'
    ? {
        auth_method: 'private_key_jwt',
        issuer: values.issuer,
        client_id: values.client_id,
        authorization_parameters,
      }
    : {
        auth_method: 'client_secret',
        issuer: values.issuer,
        client_id: values.client_id,
        client_secret: values.client_secret,
        authorization_parameters,
      }
}

export const toFormParameters = (
  configuration: schemas['OIDCConfigurationRead'],
): SSOConnectionFormValues['authorization_parameters'] =>
  Object.entries(configuration.authorization_parameters ?? {}).map(
    ([key, value]) => ({ key, value }),
  )
