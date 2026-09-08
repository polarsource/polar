import { PolarThemeProvider } from '@/app/providers'
import { StaticImage } from '@/components/Image/StaticImage'
import {
  VisionBeliefs,
  VisionProblem,
} from '@/components/Void/Vision/VisionBeliefs'
import { VisionDirection } from '@/components/Void/Vision/VisionDirection'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Metadata } from 'next/types'

export const metadata: Metadata = {
  title: 'Customer state as a function, billing as a side effect',
  description:
    'Polar is evolving into a system of record for the customer, built entirely on reducers. Customer state is a function of everything that happened, and billing is a side effect of that state.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <PolarThemeProvider forceTheme="light">
      <Box
        as="main"
        minHeight="100vh"
        flexDirection="column"
        alignItems="center"
        backgroundColor="background-secondary"
        paddingHorizontal={{ base: 'xl', md: '3xl' }}
      >
        <Box width="100%" maxWidth="120rem" flexDirection="column">
          <Box
            as="section"
            width="100%"
            flexDirection="column"
            paddingTop={{ base: '3xl', md: '5xl' }}
            paddingBottom={{ base: '3xl', md: '5xl' }}
          >
            <Grid
              templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
              gap={{ base: '2xl', lg: 'l' }}
            >
              <Box alignItems="start">
                <Text variant="heading-l" as="p">
                  Vision
                </Text>
              </Box>
              <Box flexDirection="column" rowGap={{ base: '4xl', md: '5xl' }}>
                <Box flexDirection="column" rowGap="m">
                  <Text variant="heading-xl" as="h1" wrap="balance">
                    Customer state as a function
                  </Text>
                  <Text
                    variant="heading-xl"
                    as="p"
                    color="muted"
                    wrap="balance"
                  >
                    Billing as a side effect
                  </Text>
                </Box>
                <StaticImage
                  src="/assets/landing/company/polar.jpg"
                  alt="Polar graphic"
                  width={1920}
                  height={1080}
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  priority
                />
              </Box>
            </Grid>
          </Box>
          <VisionProblem />
          <VisionBeliefs />
          <VisionDirection />
        </Box>
      </Box>
    </PolarThemeProvider>
  )
}
