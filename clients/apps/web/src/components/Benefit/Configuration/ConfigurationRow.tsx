'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren, ReactNode } from 'react'

const RowShell = ({ children }: PropsWithChildren) => (
  <Box
    flexDirection="column"
    minWidth={0}
    paddingHorizontal="xl"
    paddingVertical="l"
  >
    {children}
  </Box>
)

const RowValue = ({
  value,
  monospace,
  loading,
}: {
  value?: ReactNode
  monospace?: boolean
  loading?: boolean
}): ReactNode => {
  if (loading) {
    return <Text loading placeholderText="Loading value" />
  }

  if (value === undefined || value === null || value === '') {
    return <Text color="muted">—</Text>
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return (
      <Text monospace={monospace} truncate>
        {value}
      </Text>
    )
  }

  return value
}

export const ConfigurationRow = ({
  label,
  value,
  monospace,
  loading,
}: {
  label: string
  value?: ReactNode
  monospace?: boolean
  loading?: boolean
}) => (
  <RowShell>
    <Box
      minWidth={0}
      flexDirection={{ base: 'column', sm: 'row' }}
      alignItems={{ base: 'start', sm: 'baseline' }}
      justifyContent="between"
      gap={{ base: 'xs', sm: 'l' }}
    >
      <Box flexShrink={0}>
        <Text color="muted">{label}</Text>
      </Box>
      <Box
        flex={1}
        minWidth={0}
        alignItems="center"
        justifyContent={{ base: 'start', sm: 'end' }}
        columnGap="s"
      >
        <RowValue value={value} monospace={monospace} loading={loading} />
      </Box>
    </Box>
  </RowShell>
)

export const ConfigurationBlock = ({
  label,
  children,
}: PropsWithChildren<{ label: string }>) => (
  <RowShell>
    <Box flexDirection="column" minWidth={0} rowGap="s">
      <Text color="muted">{label}</Text>
      {children}
    </Box>
  </RowShell>
)

export const ConfigurationParagraph = ({
  children,
  fallback,
}: {
  children?: string | null
  fallback: string
}) =>
  children ? (
    // Notes and welcome messages are authored as multi-line text, so each
    // source line gets its own Text to keep the author's line breaks.
    <Box flexDirection="column" rowGap="none">
      {children.split('\n').map((line, index) => (
        <Text key={index}>{line || '\u00a0'}</Text>
      ))}
    </Box>
  ) : (
    <Text color="muted">{fallback}</Text>
  )

export const ConfigurationEntry = ({
  name,
  detail,
  monospace,
}: {
  name: string
  detail?: string
  monospace?: boolean
}) => (
  <Box
    minWidth={0}
    alignItems="baseline"
    justifyContent="between"
    columnGap="l"
  >
    <Text truncate>{name}</Text>
    {detail && (
      <Box flexShrink={0}>
        <Text color="muted" monospace={monospace}>
          {detail}
        </Text>
      </Box>
    )}
  </Box>
)
