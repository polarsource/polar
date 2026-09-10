import type { ListenError } from '@/commands/listen'
import type { TriggerError } from '@/commands/trigger'
import type { UpdateError } from '@/commands/update'
import type { AuthError } from '@/schemas/Auth'
import type { GitHubReleaseError } from '@/services/github-releases'

export type CommandError =
  | AuthError
  | ListenError
  | TriggerError
  | UpdateError
  | GitHubReleaseError

export interface ErrorDescription {
  title: string
  hint?: string
}

const releasesHint =
  'Releases are published at https://github.com/polarsource/polar/releases'

const listenHint = (code: number) => {
  switch (code) {
    case 403:
      return 'You do not have access to this organization.'
    case 404:
      return 'The organization could not be found.'
    default:
      return code >= 500
        ? 'The Polar API may be having issues, try again shortly.'
        : undefined
  }
}

const isCommandError = (error: unknown): error is CommandError =>
  typeof error === 'object' &&
  error !== null &&
  '_tag' in error &&
  [
    'AuthError',
    'ListenError',
    'TriggerError',
    'UpdateError',
    'GitHubReleaseError',
  ].includes(String(error._tag))

export const describeError = (error: unknown): ErrorDescription => {
  if (!isCommandError(error)) {
    return {
      title:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
  switch (error._tag) {
    case 'AuthError':
      return { title: error.message }
    case 'TriggerError':
      return error.hint
        ? { title: error.message, hint: error.hint }
        : { title: error.message }
    case 'ListenError': {
      const hint = listenHint(error.code)
      return hint ? { title: error.message, hint } : { title: error.message }
    }
    case 'UpdateError':
      return { title: error.message, hint: releasesHint }
    case 'GitHubReleaseError':
      return {
        title: `Could not check for updates: ${error.message}`,
        hint: releasesHint,
      }
  }
}
