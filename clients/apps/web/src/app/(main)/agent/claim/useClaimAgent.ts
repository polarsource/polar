'use client'

import { promptSessionRefresh } from '@/components/SessionRefresh/store'
import { useAuth } from '@/hooks/auth'
import { useConfirmAgentClaim } from '@/hooks/queries/agents'
import { isSessionNotFreshError } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  AGENT_CLAIM_RESUME_PARAM,
  pendingAgentClaims,
} from './claimContinuation'
import {
  type AgentClaimError,
  getAgentClaimError,
  UNKNOWN_ERROR_MESSAGE,
} from './claimErrors'

export type ClaimState =
  | { status: 'idle' }
  | AgentClaimError
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
  const resumedCode = useRef<string | null>(null)

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
          ? pendingAgentClaims.save(linkToken, currentUser.id, code)
          : null
        if (actionId) {
          promptSessionRefresh({
            returnTo: pendingAgentClaims.getResumePath(actionId),
          })
        }
        return null
      }

      return getAgentClaimError(error)
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

  const resumeOnceLoaded = useEffectEvent(() => {
    const code = resumedCode.current
    if (!claim || !code) return

    resumedCode.current = null
    void confirm(code)
  })

  useEffect(() => {
    const userId = currentUser?.id
    if (
      !resumeActionId ||
      !userId ||
      resumedActionId.current === resumeActionId
    ) {
      return
    }

    resumedActionId.current = resumeActionId

    const url = new URL(window.location.href)
    url.searchParams.delete(AGENT_CLAIM_RESUME_PARAM)
    window.history.replaceState(window.history.state, '', url)

    resumedCode.current = pendingAgentClaims.take(
      resumeActionId,
      linkToken,
      userId,
    )
    resumeOnceLoaded()
  }, [currentUser?.id, linkToken, resumeActionId])

  useEffect(() => {
    resumeOnceLoaded()
  }, [claim])

  return { state, confirm, isPending }
}
