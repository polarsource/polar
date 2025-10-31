import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

export const useDisconnectOAuthAccount = () => {
  const queryClient = useQueryClient()
  const { reloadUser } = useAuth()

  return useMutation({
    mutationFn: (platform: schemas['OAuthPlatform']) => {
      return api.DELETE('/v1/users/me/oauth-accounts/{platform}', {
        params: {
          path: { platform },
        },
      })
    },
    onSuccess: async () => {
      // Reload user data to get updated oauth_accounts list
      await reloadUser()
      // Invalidate queries that might depend on OAuth accounts
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })
}
