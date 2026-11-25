'use client'

import { usePostHog } from '@/hooks/posthog'
import { useImpressionEvent } from '@/hooks/useImpressionEvent'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import AgentClaimLayout, { CLAIM_STEPS } from './AgentClaimLayout'
import { useAutoClose } from './useAutoClose'

const AUTO_CLOSE_SECONDS = 5

type ClaimedOrganization = Pick<
  schemas['AgentClaimOrganization'],
  'id' | 'name' | 'slug'
>

const AgentClaimSuccess = ({
  organization,
  agentName,
  autoClose = false,
}: {
  organization: ClaimedOrganization | null
  agentName?: string | null
  autoClose?: boolean
}) => {
  const posthog = usePostHog()
  const { secondsLeft, stop } = useAutoClose(
    autoClose ? AUTO_CLOSE_SECONDS : null,
  )
  const dashboardPath = organization
    ? `/dashboard/${organization.slug}`
    : '/dashboard'

  useImpressionEvent({
    event: 'dashboard:agent:claim_success:view',
    build: () => ({
      organization_id: organization?.id ?? null,
      has_agent_name: Boolean(agentName),
    }),
  })

  return (
    <AgentClaimLayout
      currentStepIndex={CLAIM_STEPS.length}
      title={organization ? `${organization.name} is yours` : 'Setup complete'}
      subtitle={`Switch back to ${agentName || 'your agent'} to continue. It will pick up where it left off.`}
      actions={
        <Button asChild variant="secondary">
          <a
            href={dashboardPath}
            onClick={() => {
              stop()
              posthog.capture('dashboard:agent:dashboard_link:click', {
                organization_id: organization?.id ?? null,
              })
            }}
          >
            Go to dashboard
          </a>
        </Button>
      }
    >
      <Box
        paddingTop="xl"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Text color="muted">
          {secondsLeft
            ? `This page will close in ${secondsLeft} ${secondsLeft === 1 ? 'second' : 'seconds'}…`
            : 'You can close this tab.'}
        </Text>
      </Box>
    </AgentClaimLayout>
  )
}

export default AgentClaimSuccess
