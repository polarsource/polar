'use client'

import { Button, Input } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Bot } from '@polar-sh/orbit/icons'
import { SetupCard } from './SetupCards'

interface Props {
  prompt: string | null
  onCopy: () => void
}

export const PromptCard = ({ prompt, onCopy }: Props) => (
  <SetupCard>
    <Box alignItems="center" columnGap="s">
      <Box display="block" flex={1}>
        <Input
          readOnly
          aria-label="Setup prompt for your coding agent"
          value={prompt ?? ''}
          placeholder="Preparing your prompt…"
          preSlot={<Bot size={16} />}
          onFocus={(event) => event.target.select()}
        />
      </Box>
      <Button onClick={onCopy} disabled={!prompt}>
        Copy
      </Button>
    </Box>
  </SetupCard>
)
