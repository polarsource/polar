'use client'

import { promptSessionRefresh } from '@/components/SessionRefresh/store'
import { useAuth } from '@/hooks/auth'
import { useConfirmAgentClaim } from '@/hooks/queries/agents'
import { isSessionNotFreshError } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  AGENT_CLAIM_RESUME_PARAM,
  getAgentClaimResumePath,
  savePendingAgentClaim,
  takePendingAgentClaim,
} from './claimContinuation'
import {
  type AgentClaimProblem,
  getAgentClaimProblem,
  INVALID_CODE_MESSAGE,
  isInvalidCodeError,
  UNKNOWN_ERROR_MESSAGE,
} from './claimErrors'

export type ClaimState =
  | { status: 'idle' }
  | { status: 'invalid'; message: string }
  | { status: 'failed'; problem: AgentClaimProblem }
  | { status: 'claimed' }

export const useClaimAgent = (
  linkToken: string,
  claim: schemas['AgentClaim'] | undefined,
  resumeActionId: string | undefined,
) => {
  const { currentUser } = useAuth()
  const { mutateAsync, isPending } = useConfirmAgentClaim()
  const [state, setState] = useState<ClaimState>({ status: 'idle' })
  const resumedActionId = useRef<string | null>(null)

  const submitCode = useCallback(
    async (code: string): Promise<ClaimState | null> => {
      const result = await mutateAsync({ link_token: linkToken, code }).catch(
        () => undefined,
      )
      if (!result) {
        return { status: 'invalid', message: UNKNOWN_ERROR_MESSAGE }
      }

      const { error } = result
      if (!error) {
        window.location.assign(
          claim?.organization
            ? `/dashboard/${claim.organization.slug}`
            : '/dashboard',
        )
        return { status: 'claimed' }
      }

      if (isSessionNotFreshError(error)) {
        const actionId = currentUser
          ? savePendingAgentClaim(linkToken, currentUser.id, code)
          : null
        if (actionId) {
          promptSessionRefresh({ returnTo: getAgentClaimResumePath(actionId) })
        }
        return null
      }

      if (isInvalidCodeError(error)) {
        return { status: 'invalid', message: INVALID_CODE_MESSAGE }
      }

      const problem = getAgentClaimProblem(error)
      return problem
        ? { status: 'failed', problem }
        : { status: 'invalid', message: UNKNOWN_ERROR_MESSAGE }
    },
    [claim, currentUser, linkToken, mutateAsync],
  )

  const confirm = useCallback(
    (code: string) =>
      submitCode(code).then((next) => {
        if (next) setState(next)
      }),
    [submitCode],
  )

  const resume = useEffectEvent((code: string) => {
    void confirm(code)
  })

  useEffect(() => {
    const userId = currentUser?.id
    if (
      !resumeActionId ||
      !userId ||
      !claim ||
      resumedActionId.current === resumeActionId
    ) {
      return
    }

    resumedActionId.current = resumeActionId

    const url = new URL(window.location.href)
    url.searchParams.delete(AGENT_CLAIM_RESUME_PARAM)
    window.history.replaceState(window.history.state, '', url)

    const code = takePendingAgentClaim(resumeActionId, linkToken, userId)
    if (code) resume(code)
  }, [claim, currentUser?.id, linkToken, resumeActionId])

  return { state, confirm, isPending }
}
