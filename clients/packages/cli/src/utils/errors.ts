import type { ApiCommandError } from '@polar-sh/cli-commands'
import type { ListenError } from '@/services/listen'
import type { TriggerError } from '@/schemas/Trigger'
import type { UpdateError } from '@/services/update'
import type { AgentSetupError } from '@/schemas/AgentSetup'
import type { AuthError } from '@/schemas/Auth'
import type { BillingConfigError } from '@/schemas/BillingConfig'
import type { GitHubReleaseError } from '@/services/github-releases'
import type { UpdaterError } from '@/services/updater'
import type { JsonUnsupportedError } from '@/utils/command'
import type { PullRequestCommentError } from '@/services/pull-request-comment'
import * as ui from '@/utils/ui'

type CommandError =
  | AgentSetupError
  | ApiCommandError
  | AuthError
  | BillingConfigError
  | ListenError
  | TriggerError
  | UpdateError
  | UpdaterError
  | GitHubReleaseError
  | JsonUnsupportedError
  | PullRequestCommentError

interface ErrorDescription {
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
    'AgentSetupError',
    'ApiCommandError',
    'AuthError',
    'BillingConfigError',
    'ListenError',
    'TriggerError',
    'UpdateError',
    'UpdaterError',
    'GitHubReleaseError',
    'JsonUnsupportedError',
    'PullRequestCommentError',
  ].includes(String(error._tag))

const errorJson = (error: unknown) => {
  const { title, hint } = describeError(error)
  return JSON.stringify({
    error: isCommandError(error) ? error._tag : 'UnexpectedError',
    message: title,
    ...(hint ? { hint } : {}),
  })
}

export const isJsonFlag = (args: ReadonlyArray<string>) =>
  args.some((arg) => arg === '--json' || /^--json=(true|yes|on|1|y)$/.test(arg))

export const reportedError = (args: ReadonlyArray<string>, error: unknown) => {
  if (!isJsonFlag(args)) {
    const { title, hint } = describeError(error)
    return `\n${ui.failure(title, hint)}\n\n`
  }
  return `${errorJson(error)}\n`
}

const withHint = (title: string, hint: string | undefined): ErrorDescription =>
  hint ? { title, hint } : { title }

const describeUnknown = (error: unknown): ErrorDescription => ({
  title:
    error instanceof Error ? error.message : 'An unexpected error occurred',
})

export const describeError = (error: unknown): ErrorDescription => {
  if (!isCommandError(error)) return describeUnknown(error)
  switch (error._tag) {
    case 'AuthError':
      return { title: error.message }
    case 'BillingConfigError':
    case 'AgentSetupError':
    case 'ApiCommandError':
    case 'TriggerError':
    case 'PullRequestCommentError':
      return withHint(error.message, error.hint)
    case 'ListenError':
      return withHint(error.message, listenHint(error.code))
    case 'JsonUnsupportedError':
      return { title: error.message, hint: error.hint }
    case 'UpdateError':
    case 'UpdaterError':
      return { title: error.message, hint: error.hint ?? releasesHint }
    case 'GitHubReleaseError':
      return {
        title: `Could not check for updates: ${error.message}`,
        hint: releasesHint,
      }
  }
}
