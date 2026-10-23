import { extractApiErrorMessage } from '@/utils/api/errors'

export interface AgentClaimProblem {
  title: string
  description: string
  canSwitchAccount?: boolean
}

export type AgentClaimError =
  | { status: 'invalid'; message: string }
  | { status: 'failed'; problem: AgentClaimProblem }

export const UNKNOWN_PROBLEM: AgentClaimProblem = {
  title: 'Could not load this claim',
  description: 'Something went wrong. Reload the page to try again.',
}

export const UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export const RATE_LIMITED_MESSAGE =
  'Too many attempts. Wait a few minutes and try again.'

export const getAgentClaimErrorType = (body: unknown): string | undefined =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  typeof body.error === 'string'
    ? body.error
    : undefined

const failed = (problem: AgentClaimProblem): AgentClaimError => ({
  status: 'failed',
  problem,
})

export const getAgentClaimError = (body: unknown): AgentClaimError => {
  switch (getAgentClaimErrorType(body)) {
    case 'AgentClaimInvalidCode':
      return {
        status: 'invalid',
        message:
          'This code is wrong. Check the code your agent gave you and try again.',
      }
    case 'AgentClaimEmailMismatch':
      return failed({
        title: 'Sign in with another account',
        description: `${extractApiErrorMessage(
          body as { detail?: unknown },
          'This claim was started for another email.',
        )} Once you’re signed in with it, open the claim link from your agent again.`,
        canSwitchAccount: true,
      })
    case 'AgentClaimExpired':
      return failed({
        title: 'This claim has expired',
        description:
          'Ask your agent to start a new claim to get a new link and code.',
      })
    case 'ResourceNotFound':
      return failed({
        title: 'This claim link doesn’t work',
        description:
          'It may have been used already, or replaced by a newer one. Ask your agent for its latest claim link.',
      })
    default:
      return { status: 'invalid', message: UNKNOWN_ERROR_MESSAGE }
  }
}
