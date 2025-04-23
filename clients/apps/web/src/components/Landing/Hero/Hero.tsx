'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import Dither from '@/src/components/Dither/Dither'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { twMerge } from 'tailwind-merge'

export const Hero = ({ className }: { className?: string }) => {
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

  const { resolvedTheme } = useTheme()

  return (
    <motion.div
      className={twMerge(
        'relative flex flex-col items-center justify-center gap-12 overflow-hidden rounded-3xl px-8 py-16 text-center md:py-24',
        className,
      )}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="absolute inset-0 -z-10">
        <Dither
          waveAmplitude={0}
          waveFrequency={0}
          waveColor={
            resolvedTheme === 'dark' ? [0.35, 0.35, 0.35] : [0.8, 0.8, 0.8]
          }
          enableMouseInteraction={false}
          invert={resolvedTheme === 'light'}
        />
        <div className="absolute inset-0 bg-white/70 dark:bg-black/30" />
      </div>
      <motion.h1
        className="max-w-4xl text-balance px-8 text-5xl !leading-tight tracking-tight text-gray-950 md:px-0 md:text-7xl dark:text-white"
        variants={itemVariants}
      >
        Payment infrastructure for the 21st century
      </motion.h1>
      <motion.p
        className="text-pretty px-8 text-2xl leading-relaxed md:px-0"
        variants={itemVariants}
      >
        The modern way to sell your SaaS and digital products
      </motion.p>
      <motion.div
        className="flex flex-row items-center gap-x-4"
        variants={itemVariants}
      >
        <GetStartedButton
          size="lg"
          text="Get Started"
          className="rounded-full bg-black font-medium text-white hover:bg-gray-900 dark:bg-white dark:text-black"
        />
      </motion.div>
    </motion.div>
  )
}
