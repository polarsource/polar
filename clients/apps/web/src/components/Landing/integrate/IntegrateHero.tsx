import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { BackdropPanel } from './Backdrop'
import { SurfaceCards } from './SurfaceCards'
import { SurfaceCycle } from './SurfaceCycle'

const DOCS_HREF = '/docs/integrate/sdk/introduction'

export const IntegrateHero = () => (
  <Box
    as="section"
    width="100%"
    paddingTop={{ base: 'm', md: '3xl' }}
    paddingBottom={{ base: '3xl', md: '5xl' }}
    flexDirection="column"
    rowGap={{ base: '4xl', md: '5xl' }}
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
        <Box flexDirection="column" rowGap="s">
          <Text variant="heading-m" as="h1" wrap="balance">
            Integrate Polar
          </Text>
          <Text variant="heading-m" as="p" color="muted" wrap="balance">
            Wire billing in from your agent, your framework or your terminal
          </Text>
        </Box>
        <Box alignItems="center" columnGap="m">
          <GetStartedButton size="lg" text="Get Started" />
          <a href={DOCS_HREF}>
            <Button size="lg" variant="secondary">
              Documentation
            </Button>
          </a>
        </Box>
      </Box>
      <BackdropPanel
        src="/assets/landing/company/Polar_Flow_03_No_Logo.jpg"
        aspectRatio="4 / 3"
      >
        <SurfaceCycle />
      </BackdropPanel>
    </Grid>
    <SurfaceCards />
  </Box>
)
