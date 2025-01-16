import { OAuthAccountRead, OAuthPlatform } from '@polar-sh/api'
import { useMemo } from 'react'
import { useAuth } from '.'

export const useOAuthAccounts = (): OAuthAccountRead[] => {
  const { currentUser } = useAuth()
  return currentUser?.oauth_accounts || []
}

export const usePlatformOAuthAccount = (
  platform: OAuthPlatform,
): OAuthAccountRead | undefined => {
  const oauthAccounts = useOAuthAccounts()
  return useMemo(
    () =>
      oauthAccounts.find((oauthAccount) => oauthAccount.platform === platform),
    [oauthAccounts, platform],
  )
}

export const useGitHubAccount = (): OAuthAccountRead | undefined =>
  usePlatformOAuthAccount(OAuthPlatform.GITHUB)

export const useGoogleAccount = (): OAuthAccountRead | undefined =>
  usePlatformOAuthAccount(OAuthPlatform.GOOGLE)
