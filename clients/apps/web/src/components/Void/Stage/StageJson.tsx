'use client'

import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import type { Stage } from './queries'

export const StageJson = ({ stage }: { stage: Stage }) => {
  const [expanded, setExpanded] = useState(false)
  return (
    <Box flexDirection="column" rowGap="s" minWidth={0}>
      <Box alignSelf="start" marginLeft="-m">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? (
            <KeyboardArrowDown fontSize="inherit" />
          ) : (
            <KeyboardArrowRight fontSize="inherit" />
          )}
          <Text as="span" variant="caption" color="muted">
            Staged JSON · Revision {stage.revision}
          </Text>
        </Button>
      </Box>
      {expanded ? (
        <Box
          padding="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          borderRadius="m"
          backgroundColor="background-card"
          overflow="auto"
          maxHeight={480}
        >
          <pre>
            <Text as="code" variant="caption" monospace>
              {JSON.stringify(stage.configuration, null, 2)}
            </Text>
          </pre>
        </Box>
      ) : null}
    </Box>
  )
}
