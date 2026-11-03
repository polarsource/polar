import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { CopyButton } from './CopyButton'

export const Field = ({
  label,
  copyValue,
  children,
}: {
  label: string
  copyValue?: string
  children: ReactNode
}) => (
  <div className="group">
    <Box alignItems="center" gap="m" minHeight={26}>
      <Box width={84} flexShrink={0}>
        <Text color="muted">{label}</Text>
      </Box>
      <Box minWidth={0} flexGrow={1}>
        {children}
      </Box>
      {copyValue && (
        <div className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <CopyButton value={copyValue} label={`Copy ${label.toLowerCase()}`} />
        </div>
      )}
    </Box>
  </div>
)
