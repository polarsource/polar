import { StateCreator } from 'zustand'

interface GitHubInstallation {
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
    organizationId: undefined,
  },
  setGitHubInstallation: (gitHubInstallation) => {
    set({
      gitHubInstallation,
    })
  },
  clearGitHubInstallation: () => {
    set({
      gitHubInstallation: undefined,
    })
  },
})
