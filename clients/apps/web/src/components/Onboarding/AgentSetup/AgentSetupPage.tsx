'use client'

import { ChecklistRow } from '@/components/Finance/Account/ChecklistRow'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useHasPermission } from '@/hooks/permissions'
import { usePostHog } from '@/hooks/posthog'
import {
  useAgentSetupRun,
  useCreateAgentSetupRun,
} from '@/hooks/queries/agentSetupRuns'
import { useOrganizationReviewState } from '@/hooks/queries/org'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@polar-sh/client'
import { Alert, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Bot, User } from '@polar-sh/orbit/icons'
import { useEffect, useRef } from 'react'
import { PlansReview } from './PlansReview'
import { SetupCard, SetupColumn, StepRow } from './SetupCards'
import { SetupNotices } from './SetupNotices'
import { buildSetupPrompt } from './setupPrompt'
import {
  agentRows,
  isDone,
  plansAwaitApproval,
  userChecks,
  waitingStage,
} from './steps'

const RUN_POLL_INTERVAL = 3000

export const AgentSetupPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const canManage = useHasPermission(organization.id, 'organization:manage')
  const { data: run, isSuccess: runLoaded } = useAgentSetupRun(
    organization.id,
    RUN_POLL_INTERVAL,
  )
  const { data: reviewState, isLoading } = useOrganizationReviewState(
    organization.id,
    canManage,
  )
  const {
    mutate: createRun,
    data: createdRun,
    isPending: isCreatingRun,
  } = useCreateAgentSetupRun(organization.id)
  const safeCopy = useSafeCopy(toast)
  const posthog = usePostHog()

  const agentConnected = Object.keys(run?.stages ?? {}).length > 0
  const promptRequested = useRef(false)
  useEffect(() => {
    if (!canManage || !runLoaded || agentConnected || promptRequested.current) {
      return
    }
    promptRequested.current = true
    createRun()
  }, [canManage, runLoaded, agentConnected, createRun])

  const runProgress = run?.modified_at ?? run?.created_at
  useEffect(() => {
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
  }, [runProgress, organization.id])

  if (!canManage) {
    return (
      <DashboardBody title="Set up Polar with your coding agent">
        <Alert
          variant="info"
          title="You need an owner or admin for this"
          description="Only owners and admins can start a setup run and finish account setup."
        />
      </DashboardBody>
    )
  }

  const prompt = createdRun
    ? buildSetupPrompt(organization, createdRun.code)
    : null
  const copyPrompt = async () => {
    if (!prompt) {
      return
    }
    posthog.capture('dashboard:onboarding:ai_setup_prompt:click', {
      organization: organization.id,
    })
    await safeCopy(prompt)
    toast({
      title: 'Setup prompt copied',
      description: 'Paste it into your coding agent, in your project.',
    })
  }

  const checks = reviewState?.preliminary_steps ?? []
  const agent = agentRows(run, checks)
  const own = userChecks(checks)
  const awaitingApproval = plansAwaitApproval(run)
  const hasPlans = (run?.drafts?.products?.length ?? 0) > 0
  const waiting = waitingStage(run)

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-lg)!"
      title="Set up Polar with your coding agent"
      titleActions={
        agentConnected ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => createRun()}
            loading={isCreatingRun}
          >
            New prompt
          </Button>
        ) : undefined
      }
    >
      <Box flexDirection="column" paddingBottom="3xl">
        <SetupNotices
          prompt={agentConnected ? undefined : prompt}
          onCopy={copyPrompt}
          waiting={waiting}
        />

        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }}
          alignItems="start"
          gap="xl"
        >
          <SetupColumn
            icon={<Bot size={16} />}
            title="Your agent"
            done={
              agent.filter((row) => 'step' in row && row.step.state === 'done')
                .length
            }
            total={agent.length}
          >
            {agent.map((row) => (
              <SetupCard key={row.key}>
                {'check' in row ? (
                  <ChecklistRow
                    isLoading={false}
                    step={row.check}
                    label={row.label}
                    description="Not found in your app"
                  />
                ) : (
                  <StepRow step={row.step} />
                )}
              </SetupCard>
            ))}
          </SetupColumn>

          <SetupColumn
            icon={<User size={16} />}
            title="You"
            done={
              own.filter(isDone).length +
              (hasPlans && !awaitingApproval ? 1 : 0)
            }
            total={own.length + (hasPlans ? 1 : 0)}
          >
            {hasPlans ? (
              <SetupCard>
                <Box flexDirection="column" rowGap="m">
                  <StepRow
                    step={{
                      key: 'plans',
                      label: 'Approve your plans',
                      state: awaitingApproval ? 'waiting' : 'done',
                    }}
                  />
                  {awaitingApproval && run?.drafts ? (
                    <PlansReview
                      organization={organization}
                      drafts={run.drafts}
                    />
                  ) : null}
                </Box>
              </SetupCard>
            ) : null}
            {isLoading
              ? Array.from({ length: 3 }, (_, index) => (
                  <SetupCard key={index}>
                    <ChecklistRow isLoading={true} />
                  </SetupCard>
                ))
              : own.map((check) => (
                  <SetupCard key={check.key}>
                    <ChecklistRow
                      isLoading={false}
                      step={check}
                      description={
                        check.key === 'payout_account' ? null : undefined
                      }
                    />
                  </SetupCard>
                ))}
          </SetupColumn>
        </Box>
      </Box>
    </DashboardBody>
  )
}
