import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { BackdropPanel, type BackdropSrc } from './Backdrop'

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
  backdrop?: BackdropSrc
}

const CodeBody = ({ caption, lines }: Omit<CodePanelProps, 'backdrop'>) => (
  <Box flexDirection="column" rowGap="xl" minWidth={0} overflowX="auto">
    <Text variant="default" color="muted" monospace>
      {caption}
    </Text>
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <CodeLine key={index} line={line} />
      ))}
    </Box>
  </Box>
)

export const CodePanel = ({ caption, lines, backdrop }: CodePanelProps) =>
  backdrop ? (
    <BackdropPanel src={backdrop}>
      <CodeBody caption={caption} lines={lines} />
    </BackdropPanel>
  ) : (
    <Box
      flexDirection="column"
      padding={{ base: 'xl', md: '2xl' }}
      minWidth={0}
      backgroundColor="background-secondary"
    >
      <CodeBody caption={caption} lines={lines} />
    </Box>
  )
