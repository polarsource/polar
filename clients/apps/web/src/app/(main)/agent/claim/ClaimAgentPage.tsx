'use client'

import { OnboardingLayout } from '@/components/Layout/OnboardingLayout'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { useAuth, useLogout } from '@/hooks/auth'
import { useAgentClaim } from '@/hooks/queries/agents'
import { ClientResponseError } from '@polar-sh/client'
import { Alert, Avatar, Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import AgentClaimCodeForm, { CLAIM_CODE_LENGTH } from './AgentClaimCodeForm'
import AgentClaimSummary from './AgentClaimSummary'
import {
  type AgentClaimProblem,
  getAgentClaimError,
  UNKNOWN_PROBLEM,
} from './claimErrors'
import { useClaimAgent } from './useClaimAgent'

const FORM_ID = 'agent-claim'

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
}: {
  linkToken: string
  resumeActionId?: string
}) {
  const { currentUser } = useAuth()
  const logout = useLogout()
  const { data: claim, error: loadError } = useAgentClaim(linkToken)
  const { state, confirm, isPending } = useClaimAgent(
    linkToken,
    claim,
    resumeActionId,
  )
  const [code, setCode] = useState('')

  const problem =
    state.status === 'failed'
      ? state.problem
      : loadError && state.status !== 'claimed'
        ? getLoadProblem(loadError)
        : undefined
  const isReady = claim && !problem && state.status !== 'claimed'

  const submit = () => {
    if (code.length === CLAIM_CODE_LENGTH && !isPending) void confirm(code)
  }

  return (
    <OnboardingLayout
      branding={
        <Box color="text-primary">
          <PolarLogotype logoVariant="logotype" logoClassName="ml-0" />
        </Box>
      }
      introduction={
        <Text variant="body">
          An AI agent set up Polar for you. Claim it to own what it built and
          let it keep working on your behalf.
        </Text>
      }
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
      title={
        state.status === 'claimed'
          ? 'Agent claimed'
          : isReady && claim.agent_name
            ? `Claim ${claim.agent_name}`
            : 'Claim your agent'
      }
      subtitle={
        isReady
          ? 'Enter the code your agent gave you to become the owner.'
          : undefined
      }
      actions={
        isReady ? (
          <Button
            form={FORM_ID}
            type="submit"
            loading={isPending}
            disabled={code.length < CLAIM_CODE_LENGTH}
          >
            Claim agent
          </Button>
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
        ) : state.status === 'claimed' ? (
          <Alert
            variant="success"
            loading
            title={
              claim?.organization
                ? `${claim.organization.name} is yours`
                : 'The agent is yours'
            }
            description="Taking you to your dashboard…"
          />
        ) : claim ? (
          <>
            <AgentClaimSummary claim={claim} />
            <Alert
              variant="warning"
              title="The agent will act as you"
              description={`Once you claim it, ${claim.agent_name || 'the agent'} can do anything you can on Polar, in all your organizations.`}
            />
            <AgentClaimCodeForm
              id={FORM_ID}
              code={code}
              error={state.status === 'invalid' ? state.message : undefined}
              onChange={setCode}
              onSubmit={submit}
            />
          </>
        ) : (
          <Box justifyContent="center" paddingVertical="3xl">
            <Spinner />
          </Box>
        )}
      </Box>
    </OnboardingLayout>
  )
}
