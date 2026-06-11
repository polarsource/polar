import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { type ReactNode } from 'react'

export interface PropRow {
  name: string
  type: string
  default?: string
  description?: ReactNode
  required?: boolean
}

function Cell({ children }: { children: ReactNode }) {
  return (
    <Box paddingVertical="m" paddingHorizontal="l" minWidth={0}>
      {children}
    </Box>
  )
}

export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <Box
      flexDirection="column"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      overflow="hidden"
    >
      <Box
        display="grid"
        gridTemplateColumns="minmax(120px, 1.2fr) minmax(160px, 2fr) minmax(80px, 1fr)"
        backgroundColor="background-secondary"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Cell>
          <Text variant="label" color="muted">
            Prop
          </Text>
        </Cell>
        <Cell>
          <Text variant="label" color="muted">
            Type
          </Text>
        </Cell>
        <Cell>
          <Text variant="label" color="muted">
            Default
          </Text>
        </Cell>
      </Box>

      {rows.map((row, i) => (
        <Box key={row.name} flexDirection="column">
          <Box
            display="grid"
            gridTemplateColumns="minmax(120px, 1.2fr) minmax(160px, 2fr) minmax(80px, 1fr)"
            borderTopWidth={i === 0 ? 0 : 1}
            borderStyle="solid"
            borderColor="border-secondary"
          >
            <Cell>
              <Box alignItems="center" columnGap="xs" flexWrap="wrap">
                <Text variant="mono" color="inherit">
                  {row.name}
                </Text>
                {row.required && (
                  <Text variant="caption" color="danger">
                    *
                  </Text>
                )}
              </Box>
            </Cell>
            <Cell>
              <Text variant="mono" color="accent">
                {row.type}
              </Text>
            </Cell>
            <Cell>
              <Text variant="mono" color="muted">
                {row.default ?? '—'}
              </Text>
            </Cell>
          </Box>
          {row.description && (
            <Box paddingHorizontal="l" paddingBottom="m" maxWidth={620}>
              <Text variant="caption" color="muted">
                {row.description}
              </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
