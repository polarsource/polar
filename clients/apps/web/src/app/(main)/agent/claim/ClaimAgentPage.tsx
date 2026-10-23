'use client'

import Auth from '@/components/Auth/Auth'
import EmailOTPVerifyForm from '@/components/Auth/EmailOTPVerifyForm'
import { OnboardingLayout } from '@/components/Layout/OnboardingLayout'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { useAuth, useLogout } from '@/hooks/auth'
import { useImpressionEvent } from '@/hooks/useImpressionEvent'
import { useAgentClaim, useAgentClaimPreview } from '@/hooks/queries/agents'
import { type LoginMethod } from '@/utils/auth'
import { ClientResponseError, schemas } from '@polar-sh/client'
import { Alert, Avatar, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'
import AgentClaimCodeForm, { normalizeClaimCode } from './AgentClaimCodeForm'
import AgentClaimReceipt from './AgentClaimReceipt'
import AgentProgress, { type ProgressMessage } from './AgentProgress'
import {
  type AgentClaimProblem,
  getAgentClaimError,
  getAgentClaimErrorType,
  UNKNOWN_PROBLEM,
} from './claimErrors'
import { useClaimAgent } from './useClaimAgent'

const FORM_ID = 'agent-claim'

const STEPS = [
  {
    id: 'account',
    title: 'Create an account',
    description: 'To continue the setup',
  },
  {
    id: 'claim',
    title: 'Claim',
    description: 'Take ownership of what your agent set up.',
  },
] as const

const ARRIVING: ProgressMessage[] = [
  { text: 'Checking your account…', ms: 1200 },
  { text: 'Finding what your agent built…', ms: 2300 },
  { text: 'Preparing the handover…', ms: 1500 },
]

const HANDING_OVER: ProgressMessage[] = [
  { text: 'Transferring ownership…', ms: 1800 },
  { text: 'Setting up your organization…', ms: 2000 },
  { text: 'Opening your dashboard…', ms: 1200 },
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
}: {
  linkToken: string
  resumeActionId?: string
  authenticationSession: schemas['AuthenticationSession'] | null
  lastLoginMethod?: LoginMethod | null
  pacingMs?: number
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
    pacingMs,
  )
  const [code, setCode] = useState('')
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [arriving, setArriving] = useState(signedIn)
  const normalizedCode = normalizeClaimCode(code)

  useEffect(() => {
    if (!arriving) return
    const timer = setTimeout(() => setArriving(false), pacingMs)
    return () => clearTimeout(timer)
  }, [arriving, pacingMs])

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
      : error && state.status !== 'claimed'
        ? getLoadProblem(error)
        : undefined
  const isReady =
    signedIn && claim && !arriving && !problem && state.status !== 'claimed'

  const submit = () => {
    if (normalizedCode && !isPending) void confirm(normalizedCode)
  }

  return (
    <OnboardingLayout
      branding={
        <Box color="text-primary">
          <PolarLogotype logoVariant="logotype" logoClassName="ml-0" />
        </Box>
      }
      steps={STEPS}
      currentStepIndex={signedIn ? 1 : 0}
      footer={
        currentUser && (
          <Box alignItems="center" gap="s">
            <Avatar
              className="h-8 w-8"
              avatar_url={currentUser.avatar_url}
              name={currentUser.email}
            />
            <Box flexDirection="column">
              <Text variant="caption" color="muted">
                Signed in as
              </Text>
              <Text variant="label">{currentUser.email}</Text>
            </Box>
          </Box>
        )
      }
      title="Finish setup"
      subtitle={
        problem ? undefined : state.status === 'claimed' ? (
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
        ) : state.status === 'claimed' ? null : !signedIn && preview ? (
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
    </OnboardingLayout>
  )
}
