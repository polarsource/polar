'use client'

import Auth from '@/components/Auth/Auth'
import EmailOTPVerifyForm from '@/components/Auth/EmailOTPVerifyForm'
import { useAuth, useLogout } from '@/hooks/auth'
import { useImpressionEvent } from '@/hooks/useImpressionEvent'
import { useAgentClaim, useAgentClaimPreview } from '@/hooks/queries/agents'
import { type LoginMethod } from '@/utils/auth'
import { ClientResponseError, schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'
import AgentClaimCodeForm, { normalizeClaimCode } from './AgentClaimCodeForm'
import AgentClaimLayout from './AgentClaimLayout'
import AgentClaimReceipt from './AgentClaimReceipt'
import AgentClaimSuccess from './AgentClaimSuccess'
import AgentProgress, { type ProgressMessage } from './AgentProgress'
import {
  type AgentClaimProblem,
  getAgentClaimError,
  getAgentClaimErrorType,
  UNKNOWN_PROBLEM,
} from './claimErrors'
import { useClaimAgent } from './useClaimAgent'

const FORM_ID = 'agent-claim'

const ARRIVING: ProgressMessage[] = [
  { text: 'Checking your account…', ms: 1200 },
  { text: 'Finding what your agent built…', ms: 2300 },
  { text: 'Preparing the handover…', ms: 1500 },
]

const HANDING_OVER: ProgressMessage[] = [
  { text: 'Transferring ownership…', ms: 1800 },
  { text: 'Setting up your organization…', ms: 0 },
]

const LOADING: ProgressMessage[] = [{ text: 'Loading…', ms: 0 }]

const getLoadProblem = (error: Error): AgentClaimProblem => {
  const claimError =
    error instanceof ClientResponseError
      ? getAgentClaimError(error.error)
      : undefined
  return claimError?.status === 'failed' ? claimError.problem : UNKNOWN_PROBLEM
}

export default function ClaimAgentPage({
  linkToken,
  resumeActionId,
  authenticationSession,
  lastLoginMethod,
  pacingMs = 5000,
  autoClose = true,
}: {
  linkToken: string
  resumeActionId?: string
  authenticationSession: schemas['AuthenticationSession'] | null
  lastLoginMethod?: LoginMethod | null
  pacingMs?: number
  autoClose?: boolean
}) {
  const { currentUser } = useAuth()
  const logout = useLogout()
  const signedIn = Boolean(currentUser)
  const { data: preview, error: previewError } = useAgentClaimPreview(
    linkToken,
    !signedIn,
  )
  const { data: claim, error: loadError } = useAgentClaim(linkToken, signedIn)
  const { state, confirm, isPending } = useClaimAgent(
    linkToken,
    claim,
    resumeActionId,
  )
  const [code, setCode] = useState('')
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [arriving, setArriving] = useState(signedIn)
  const [handedOver, setHandedOver] = useState(false)
  const normalizedCode = normalizeClaimCode(code)
  const claimed = state.status === 'claimed'

  useEffect(() => {
    if (!arriving) return
    const timer = setTimeout(() => setArriving(false), pacingMs)
    return () => clearTimeout(timer)
  }, [arriving, pacingMs])

  useEffect(() => {
    if (!claimed) return
    const timer = setTimeout(() => setHandedOver(true), pacingMs)
    return () => clearTimeout(timer)
  }, [claimed, pacingMs])

  const error = signedIn ? loadError : previewError
  const summary = signedIn ? claim : preview

  useImpressionEvent({
    event: 'dashboard:agent:claim:view',
    enabled: summary !== undefined,
    build: () => ({
      signed_in: signedIn,
      has_organization: summary?.organization !== null,
    }),
  })
  useImpressionEvent({
    event: 'dashboard:agent:claim:fail',
    enabled: error !== null,
    build: () => ({
      signed_in: signedIn,
      reason:
        (error instanceof ClientResponseError &&
          getAgentClaimErrorType(error.error)) ||
        'unknown',
    }),
  })
  const problem =
    state.status === 'failed'
      ? state.problem
      : error && !claimed
        ? getLoadProblem(error)
        : undefined
  const isReady = signedIn && claim && !arriving && !problem && !claimed

  const submit = () => {
    if (normalizedCode && !isPending) void confirm(normalizedCode)
  }

  if (handedOver) {
    return (
      <AgentClaimSuccess
        organization={claim?.organization ?? null}
        agentName={claim?.agent_name}
        autoClose={autoClose}
      />
    )
  }

  return (
    <AgentClaimLayout
      currentStepIndex={signedIn ? 1 : 0}
      title="Finish setup"
      subtitle={
        problem ? undefined : claimed ? (
          <AgentProgress messages={HANDING_OVER} />
        ) : isReady ? (
          'Switch back to your agent and copy the code it gave\u00a0you.'
        ) : signedIn ? (
          <AgentProgress messages={ARRIVING} />
        ) : preview ? (
          codeSentTo ? (
            `Enter the 6-character code we sent to ${codeSentTo}.`
          ) : (
            `Create an account with ${preview.email} to finish setup.`
          )
        ) : (
          <AgentProgress messages={LOADING} />
        )
      }
      actions={
        isReady ? (
          <Box
            width="100%"
            justifyContent="between"
            alignItems="center"
            columnGap="xl"
          >
            <Text variant="caption" color="muted">
              Completing setup lets {claim.agent_name || 'the agent'} act on
              your behalf on Polar, in all your organizations.
            </Text>
            <Button
              form={FORM_ID}
              type="submit"
              loading={isPending}
              disabled={normalizedCode === null}
            >
              Complete setup
            </Button>
          </Box>
        ) : undefined
      }
    >
      <Box flexDirection="column" rowGap="xl">
        {problem ? (
          <Alert
            variant="danger"
            title={problem.title}
            description={problem.description}
            actions={
              problem.canSwitchAccount
                ? [{ text: 'Sign out', onClick: logout }]
                : undefined
            }
          />
        ) : claimed ? null : !signedIn && preview ? (
          codeSentTo ? (
            <Box flexDirection="column" rowGap="l">
              <EmailOTPVerifyForm intent="signup" />
              <Button variant="ghost" onClick={() => setCodeSentTo(null)}>
                Use another email
              </Button>
            </Box>
          ) : (
            <Auth
              authenticationSession={authenticationSession}
              lastLoginMethod={lastLoginMethod}
              returnTo={`/agent/claim?token=${encodeURIComponent(linkToken)}`}
              signup
              onCodeSent={setCodeSentTo}
            />
          )
        ) : claim && !arriving ? (
          <div className="animate-in fade-in duration-700">
            <Box flexDirection="column" rowGap="xl">
              <AgentClaimCodeForm
                id={FORM_ID}
                code={code}
                error={state.status === 'invalid' ? state.message : undefined}
                onChange={setCode}
                onSubmit={submit}
              />
              <AgentClaimReceipt claim={claim} />
            </Box>
          </div>
        ) : null}
      </Box>
    </AgentClaimLayout>
  )
}
