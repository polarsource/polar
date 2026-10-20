import { extractApiErrorMessage } from '@/utils/api/errors'

export interface AgentClaimProblem {
  title: string
  description: string
  canSwitchAccount?: boolean
}

export const NOT_FOUND_PROBLEM: AgentClaimProblem = {
  title: 'This claim link doesn’t work',
  description:
    'It may have been used already, or replaced by a newer one. Ask your agent for its latest claim link.',
}

export const UNKNOWN_PROBLEM: AgentClaimProblem = {
  title: 'Could not load this claim',
  description: 'Something went wrong. Reload the page to try again.',
}

export const INVALID_CODE_MESSAGE =
  'This code is wrong. Check the code your agent gave you and try again.'

export const UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Please try again.'

const getErrorType = (body: unknown): string | undefined =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  typeof body.error === 'string'
    ? body.error
    : undefined

export const isInvalidCodeError = (body: unknown): boolean =>
  getErrorType(body) === 'AgentClaimInvalidCode'

export const getAgentClaimProblem = (
  body: unknown,
): AgentClaimProblem | undefined => {
  switch (getErrorType(body)) {
    case 'AgentClaimEmailMismatch':
      return {
        title: 'Sign in with another account',
        description: extractApiErrorMessage(
          body as { detail?: unknown },
          'This claim was started for another email.',
        ),
        canSwitchAccount: true,
      }
    case 'AgentClaimLocked':
      return {
        title: 'Too many wrong codes',
        description:
          'This claim is locked. Ask your agent to start a new claim to get a new link and code.',
      }
    case 'AgentClaimExpired':
      return {
        title: 'This claim has expired',
        description:
          'Ask your agent to start a new claim to get a new link and code.',
      }
    case 'ResourceNotFound':
      return NOT_FOUND_PROBLEM
    default:
      return undefined
  }
}
