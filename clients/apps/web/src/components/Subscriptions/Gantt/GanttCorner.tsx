import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { twMerge } from 'tailwind-merge'
import { HEADER_HEIGHT, SURFACE_CLASS } from './scale'

interface GanttCornerProps {
  label: string
}

export const GanttCorner = ({ label }: GanttCornerProps) => (
  <div className={twMerge('sticky top-0 z-20', SURFACE_CLASS)}>
    <Box
      height={HEADER_HEIGHT}
      alignItems="center"
      px="l"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Text color="muted">{label}</Text>
    </Box>
  </div>
)
