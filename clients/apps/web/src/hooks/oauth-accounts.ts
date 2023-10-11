import { OAuthAccountRead, Platforms } from '@polar-sh/sdk'
import { useMemo } from 'react'
import { useRequireAuth } from '.'

export const useOAuthAccounts = (): OAuthAccountRead[] => {
  const { currentUser } = useRequireAuth()
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
