'use client'

import { promptSessionRefresh } from '@/components/SessionRefresh/store'
import { useAuth } from '@/hooks/auth'
import { usePostHog } from '@/hooks/posthog'
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
  getAgentClaimErrorType,
  RATE_LIMITED_MESSAGE,
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
  handoverMs: number,
) => {
  const { currentUser } = useAuth()
  const posthog = usePostHog()
  const { mutateAsync, isPending } = useConfirmAgentClaim()
  const [state, setState] = useState<ClaimState>({ status: 'idle' })
  const resumedActionId = useRef<string | null>(null)
  const resumedCode = useRef<string | null>(null)

  const submitCode = useCallback(
    async (code: string): Promise<ClaimState | null> => {
      posthog.capture('dashboard:agent:code:submit')
      const result = await mutateAsync({ link_token: linkToken, code }).catch(
        () => undefined,
      )
      if (!result) {
        posthog.capture('dashboard:agent:code:fail', { reason: 'network' })
        return { status: 'invalid', message: UNKNOWN_ERROR_MESSAGE }
      }

      const { error, response } = result
      if (response.ok) {
        posthog.capture('dashboard:agent:claim:complete', {
          organization_id: claim?.organization?.id ?? null,
          products: claim?.products.length ?? 0,
        })
        const destination = claim?.organization
          ? `/dashboard/${claim.organization.slug}`
          : '/dashboard'
        setTimeout(() => window.location.assign(destination), handoverMs)
        return { status: 'claimed' }
      }

      if (response.status === 429) {
        posthog.capture('dashboard:agent:code:fail', { reason: 'rate_limited' })
        return { status: 'invalid', message: RATE_LIMITED_MESSAGE }
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

      posthog.capture('dashboard:agent:code:fail', {
        reason: getAgentClaimErrorType(error) ?? 'unknown',
      })
      return getAgentClaimError(error)
    },
    [claim, currentUser, handoverMs, linkToken, mutateAsync, posthog],
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
