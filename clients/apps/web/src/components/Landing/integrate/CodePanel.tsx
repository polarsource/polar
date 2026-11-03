import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { withOffsets } from '@/utils/lines'

const isComment = (line: string) => /^\s*(\/\/|#)/.test(line)

export const CodeLine = ({ line }: { line: string }) => (
  <div className="whitespace-pre">
    <Text
      variant="default"
      as="span"
      color={isComment(line) ? 'muted' : 'default'}
      monospace
    >
      {line || <br />}
    </Text>
  </div>
)

interface CodePanelProps {
  caption: string
  lines: string[]
}

export const CodePanel = ({ caption, lines }: CodePanelProps) => (
  <Box
    flexDirection="column"
    rowGap="xl"
    padding={{ base: 'xl', md: '2xl' }}
    minWidth={0}
    overflowX="auto"
    borderRadius="m"
    backgroundColor="background-secondary"
  >
    <Text variant="default" color="muted" monospace>
      {caption}
    </Text>
    <Box flexDirection="column">
      {withOffsets(lines).map(({ line, offset }) => (
        <CodeLine key={offset} line={line} />
      ))}
    </Box>
  </Box>
)
