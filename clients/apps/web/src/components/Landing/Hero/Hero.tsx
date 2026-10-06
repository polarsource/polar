import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MissionRulers } from './MissionRulers'

export const Hero = () => {
  return (
    <Box
      as="section"
      width="100%"
      flexDirection="column"
      rowGap={{ base: '3xl', md: '4xl' }}
      paddingTop={{ base: 'm', md: '3xl' }}
      paddingBottom={{ base: '3xl', md: '5xl' }}
    >
      <Box flexDirection="column" rowGap={{ base: '4xl', md: '5xl' }}>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={{ base: '2xl', lg: 'l' }}
        >
          <Box flexDirection="column" alignItems="start" rowGap="3xl">
            <Box flexDirection="column">
              <Text variant="heading-m" as="h1" wrap="balance">
                Meet Polar
              </Text>
              <Text variant="heading-m" as="p" color="muted" wrap="balance">
                The billing stack for the intelligence era
              </Text>
            </Box>
          </Box>
        </Grid>
        <MissionRulers />
      </Box>
    </Box>
  )
}
