'use client'

import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AnimatePresence, m } from 'motion/react'
import { PromptCard } from './PromptCard'

const Collapsible = ({ children }: { children: React.ReactNode }) => (
  <m.div
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: 'auto', opacity: 1 }}
    exit={{ height: 0, opacity: 0 }}
    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
    className="overflow-hidden"
  >
    <Box display="block" paddingBottom="xl">
      {children}
    </Box>
  </m.div>
)

interface Props {
  prompt: string | null | undefined
  onCopy: () => void
  waiting: schemas['AgentSetupStageState'] | undefined
}

export const SetupNotices = ({ prompt, onCopy, waiting }: Props) => (
  <AnimatePresence initial={false}>
    {prompt !== undefined ? (
      <Collapsible key="prompt">
        <PromptCard prompt={prompt} onCopy={onCopy} />
      </Collapsible>
    ) : null}
    {waiting ? (
      <Collapsible key="waiting">
        <Alert
          variant="warning"
          title="Your agent is waiting for you"
          description={waiting.note ?? 'Check your terminal'}
          actions={
            waiting.url
              ? [
                  {
                    text: 'Open',
                    onClick: () =>
                      window.open(
                        waiting.url ?? undefined,
                        '_blank',
                        'noopener,noreferrer',
                      ),
                  },
                ]
              : undefined
          }
        />
      </Collapsible>
    ) : null}
  </AnimatePresence>
)
