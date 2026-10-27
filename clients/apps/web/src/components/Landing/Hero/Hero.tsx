import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const Hero = () => {
  return (
    <Box
      as="section"
      width="100%"
      flexDirection="column"
      rowGap={{ base: '3xl', md: '4xl' }}
      paddingTop={{ base: 'm', md: '3xl' }}
      paddingBottom={{ base: '3xl', md: '4xl' }}
    >
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
              Modern billing for AI companies
            </Text>
          </Box>
          <GetStartedButton size="lg" text="Get Started" />
        </Box>
      </Grid>
    </Box>
  )
}
