import { OAuthAccountRead, Platforms } from '@polar-sh/sdk'
import { useMemo } from 'react'
import { useAuth } from '.'

export const useOAuthAccounts = (): OAuthAccountRead[] => {
  const { currentUser } = useAuth()
  return currentUser?.oauth_accounts || []
}

export const useGitHubAccount = (): OAuthAccountRead | undefined => {
  const oauthAccounts = useOAuthAccounts()
  return useMemo(
    () =>
      oauthAccounts.find(
        (oauthAccount) => oauthAccount.platform === Platforms.GITHUB,
      ),
    [oauthAccounts],
  )
}
