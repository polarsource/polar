import { StateCreator } from 'zustand'

interface GitHubInstallation {
  installAfterGitHubAuthentication: boolean | undefined
  organizationId: string | undefined
}

export interface GitHubInstallationSlice {
  gitHubInstallation: GitHubInstallation
  setGitHubInstallation: (gitHubInstallation: GitHubInstallation) => void
  clearGitHubInstallation: () => void
}

export const createGitHubInstallationSlice: StateCreator<
  GitHubInstallationSlice
> = (set) => ({
  gitHubInstallation: {
    installAfterGitHubAuthentication: undefined,
    organizationId: undefined,
  },
  setGitHubInstallation: (gitHubInstallation) => {
    set({
      gitHubInstallation,
    })
  },
  clearGitHubInstallation: () => {
    set({
      gitHubInstallation: {
        installAfterGitHubAuthentication: undefined,
        organizationId: undefined,
      },
    })
  },
})
