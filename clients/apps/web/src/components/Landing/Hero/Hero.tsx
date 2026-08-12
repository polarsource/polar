'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'motion/react'
import { FeatureCards } from '../FeatureCards'

export const Hero = () => {
  return (
    <Box
      as="section"
      width="100%"
      flexDirection="column"
      rowGap={{ base: '3xl', md: '4xl' }}
      paddingTop={{ base: 'm', md: '5xl' }}
      paddingBottom={{ base: '3xl', md: '5xl' }}
    >
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 1 } },
        }}
        initial="hidden"
        animate="visible"
      >
        <Box flexDirection="column" rowGap={{ base: '4xl', md: '5xl' }}>
          <Grid
            templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
            gap={{ base: '2xl', lg: 'l' }}
          >
            <Box flexDirection="column" alignItems="start" rowGap="3xl">
              <Box flexDirection="column" rowGap="m">
                <Text variant="heading-xl" as="h1" wrap="balance">
                  Meet Polar
                </Text>
                <Text variant="heading-xl" as="p" color="muted" wrap="balance">
                  The financial substrate turning usage into revenue
                </Text>
              </Box>
              <GetStartedButton size="lg" text="Get Started" />
            </Box>
          </Grid>
          <FeatureCards />
        </Box>
      </motion.div>
    </Box>
  )
}
