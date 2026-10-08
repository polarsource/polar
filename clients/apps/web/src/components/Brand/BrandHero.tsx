import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import LogoReveal from './logos/LogoReveal'

export const BrandHero = () => (
  <Box
    as="section"
    width="100%"
    paddingTop={{ base: 'm', md: '3xl' }}
    paddingBottom={{ base: '3xl', md: '5xl' }}
  >
    <Grid
      templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap={{ base: '3xl', lg: 'l' }}
    >
      <Box
        flexDirection="column"
        justifyContent="between"
        alignItems="start"
        rowGap="3xl"
      >
        <Box flexDirection="column">
          <Text variant="heading-m" as="h1" wrap="balance">
            Identity for the intelligence era
          </Text>
          <Text variant="heading-m" as="p" color="muted" wrap="balance">
            A monochrome system built to stay legible at any scale
          </Text>
        </Box>
        <Button size="lg" asChild>
          <a href="/assets/brand/polar_brand.zip" download>
            Download assets
          </a>
        </Button>
      </Box>
      <Box
        aspectRatio="4 / 3"
        alignItems="center"
        justifyContent="center"
        padding={{ base: 'xl', md: '3xl' }}
        backgroundColor="background-secondary"
        color="text-primary"
      >
        <LogoReveal variant="logotype" size={240} />
      </Box>
    </Grid>
  </Box>
)
