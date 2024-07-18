import { useStore } from '@/store'
import { CONFIG } from '@/utils/config'
import { Organization } from '@polar-sh/sdk'
import { useCallback } from 'react'

export const useRedirectToGitHubInstallation = (
  organization: Organization,
): (() => void) => {
  const store = useStore()

  const redirect = useCallback(() => {
    store.setGitHubInstallation({ organizationId: organization.id })
    window.location.href = CONFIG.GITHUB_INSTALLATION_URL
  }, [store])

  return redirect
}
