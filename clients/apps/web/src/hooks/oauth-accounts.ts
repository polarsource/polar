import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import { useAuth } from '.'

export const useOAuthAccounts = (): schemas['OAuthAccountRead'][] => {
  const { currentUser } = useAuth()
  return currentUser?.oauth_accounts || []
}

export const usePlatformOAuthAccount = (
  platform: schemas['OAuthPlatform'],
): schemas['OAuthAccountRead'] | undefined => {
  const oauthAccounts = useOAuthAccounts()
  return useMemo(
    () =>
      oauthAccounts.find((oauthAccount) => oauthAccount.platform === platform),
    [oauthAccounts, platform],
  )
}

export const useGitHubAccount = (): schemas['OAuthAccountRead'] | undefined =>
  usePlatformOAuthAccount('github')

export const useGoogleAccount = (): schemas['OAuthAccountRead'] | undefined =>
  usePlatformOAuthAccount('google')
