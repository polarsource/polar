'use client'

import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { usePostHog } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import { Button, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight, Check, Copy, Sparkles } from '@polar-sh/orbit/icons'
import { useEffect, useState } from 'react'

const SETUP_COMMANDS = [
  'curl -fsSL https://polar.sh/install.sh | bash',
  'polar agent setup',
]

const CommandBlock = () => {
  const safeCopy = useSafeCopy(toast)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    await safeCopy(SETUP_COMMANDS.join('\n'))
    setCopied(true)
  }

  return (
    <Box
      alignItems="center"
      columnGap="m"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      backgroundColor="background-card"
      paddingVertical="m"
      paddingLeft="l"
      paddingRight="s"
    >
      <Box flexDirection="column" flexGrow={1} minWidth={0} overflowX="auto">
        {SETUP_COMMANDS.map((command) => (
          <Box key={command} columnGap="m">
            <Text as="span" color="muted" monospace>
              $
            </Text>
            <Text as="span" monospace wrap="nowrap">
              {command}
            </Text>
          </Box>
        ))}
      </Box>
      <Button
        variant="ghost"
        size="sm"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </Box>
  )
}

const ManageWithAgentContent = () => (
  <Box flexDirection="column" rowGap="2xl" padding="2xl">
    <Box flexDirection="column" rowGap="s">
      <Text variant="heading-xs">Manage Polar from your agent</Text>
      <Text color="muted">
        Create products, set up pricing and manage customers from the agent you
        already use.
      </Text>
    </Box>
    <Box flexDirection="column" rowGap="m">
      <Box flexDirection="column" rowGap="xs">
        <Text>Set up with the Polar CLI</Text>
        <Text variant="caption" color="muted">
          Detects the agents you have installed and adds the Polar MCP server
          and skills to them.
        </Text>
      </Box>
      <CommandBlock />
      <Box>
        <a
          href="https://polar.sh/docs/integrate/mcp"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Box
            alignItems="center"
            columnGap="xs"
            color={{ base: 'text-accent', hover: 'text-primary' }}
            transitionProperty="colors"
            transitionDuration="fast"
          >
            <Text color="inherit">Read the docs</Text>
            <ArrowUpRight className="h-4 w-4" />
          </Box>
        </a>
      </Box>
    </Box>
  </Box>
)

export const ManageWithAgentButton = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const posthog = usePostHog()
  const { isShown, show, hide } = useModal()

  const open = () => {
    posthog.capture('dashboard:products:manage_with_agent:open', {
      organization: organization.id,
    })
    show()
  }

  return (
    <>
      <Button variant="secondary" onClick={open}>
        <Sparkles className="mr-2 h-4 w-4" />
        Use your agent
      </Button>
      <Modal
        title="Polar for agents"
        className="lg:w-[560px]"
        isShown={isShown}
        hide={hide}
        modalContent={<ManageWithAgentContent />}
      />
    </>
  )
}
