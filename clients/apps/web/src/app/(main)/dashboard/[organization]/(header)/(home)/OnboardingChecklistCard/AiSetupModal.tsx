'use client'

import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { usePostHog } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { buildAiSetupPrompt } from './aiSetupPrompt'

interface Props {
  organization: schemas['Organization']
  hide: () => void
  canManageOrganization: boolean
}

export const AiSetupModalContent = ({
  organization,
  hide,
  canManageOrganization,
}: Props) => {
  const safeCopy = useSafeCopy(toast)
  const posthog = usePostHog()
  const prompt = buildAiSetupPrompt(organization)

  const copyPrompt = async () => {
    posthog.capture('dashboard:onboarding:ai_setup_prompt:click', {
      organization: organization.id,
    })
    await safeCopy(prompt)
    toast({
      title: 'Setup prompt copied',
      description: 'Paste it into the agent of your choice.',
    })
  }

  return (
    <Box flexDirection="column">
      <Box paddingTop="xl" paddingHorizontal="xl">
        <Text variant="heading-xxs">Set up Polar with your coding agent</Text>
      </Box>
      <Box flexDirection="column" rowGap="l" padding="xl">
        <Text color="muted">
          Run this prompt in your project with any coding agent. The agent
          installs the Polar SDK and wires up checkout and webhooks. It also
          creates a test product and leaves you with a checkout link to verify
          the flow end-to-end.
        </Text>
        {!canManageOrganization && (
          <Alert
            variant="info"
            title="You'll need an admin for two steps"
            description="Creating the access token and the webhook endpoint requires owner or admin permissions."
          />
        )}
        <Box
          display="block"
          maxHeight={360}
          overflow="auto"
          borderRadius="m"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          backgroundColor="background-secondary"
          padding="l"
        >
          <pre className="font-mono text-xs whitespace-pre-wrap">{prompt}</pre>
        </Box>
        <Box justifyContent="end" columnGap="m">
          <Button variant="secondary" onClick={hide}>
            Close
          </Button>
          <Button onClick={copyPrompt}>Copy prompt</Button>
        </Box>
      </Box>
    </Box>
  )
}
