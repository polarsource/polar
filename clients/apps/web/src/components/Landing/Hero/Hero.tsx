'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'motion/react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1 } },
}

export const Hero = () => {
  return (
    <motion.div
      className="relative mx-auto flex max-w-7xl flex-col items-center justify-center gap-8 px-4 pt-8 text-center md:pt-12"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <Box>
        <Text variant="heading-2xl">
          Turn Usage
          <br />
          Into Revenue
        </Text>
      </Box>
      <motion.p
        className="dark:text-polar-500 max-w-2xl text-center text-2xl leading-relaxed! text-balance text-gray-500"
        variants={itemVariants}
      >
        A billing platform for the intelligence era
      </motion.p>
      <motion.div
        className="mt-6 flex flex-col items-center gap-4 md:flex-row md:gap-6"
        variants={itemVariants}
      >
        <GetStartedButton size="lg" text="Get Started" />
      </motion.div>
    </motion.div>
  )
}
