import ArrowForward from '@mui/icons-material/ArrowForward'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

export const StartupProgramCallout = () => (
  <Link href="/startup-program" prefetch>
    <Box
      as="section"
      display="flex"
      flexDirection="row"
      alignItems="center"
      justifyContent="between"
      paddingVertical="xl"
      borderTopWidth={1}
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box display="flex" flexDirection="row" alignItems="center" columnGap="l">
        <Box
          paddingHorizontal="s"
          paddingVertical="xs"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Text variant="mono">NEW</Text>
        </Box>
        <Text variant="heading-xxs">Startup Program</Text>
      </Box>

      <Box
        display="flex"
        flexDirection="row"
        alignItems="center"
        columnGap="l"
        color={{ base: 'text-secondary', hover: 'text-primary' }}
      >
        <Text variant="body" color="inherit">
          Learn More
        </Text>
        <ArrowForward fontSize="inherit" />
      </Box>
    </Box>
  </Link>
)
