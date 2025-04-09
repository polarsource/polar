'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { motion } from 'framer-motion'
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

  return (
    <motion.div
      className={twMerge(
        'flex w-full flex-col items-center justify-center gap-12 text-center',
        className,
      )}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <motion.h1
        className="max-w-4xl text-balance px-8 text-5xl !leading-tight tracking-tight text-gray-950 md:px-0 md:text-7xl dark:text-white"
        variants={itemVariants}
      >
        Payment infrastructure for the 21st century
      </motion.h1>
      <motion.p
        className="text-pretty text-2xl leading-relaxed"
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
