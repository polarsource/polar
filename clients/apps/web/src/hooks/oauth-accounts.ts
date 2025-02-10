import { components } from '@polar-sh/client'
import { useMemo } from 'react'
import { useAuth } from '.'

export const useOAuthAccounts =
  (): components['schemas']['OAuthAccountRead'][] => {
    const { currentUser } = useAuth()
    return currentUser?.oauth_accounts || []
  }

export const usePlatformOAuthAccount = (
  platform: components['schemas']['OAuthPlatform'],
): components['schemas']['OAuthAccountRead'] | undefined => {
  const oauthAccounts = useOAuthAccounts()
  return useMemo(
    () =>
      oauthAccounts.find((oauthAccount) => oauthAccount.platform === platform),
    [oauthAccounts, platform],
  )
}

export const useGitHubAccount = ():
  | components['schemas']['OAuthAccountRead']
  | undefined => usePlatformOAuthAccount('github')

export const useGoogleAccount = ():
  | components['schemas']['OAuthAccountRead']
  | undefined => usePlatformOAuthAccount('google')
