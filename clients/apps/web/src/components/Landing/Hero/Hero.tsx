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
        'relative flex flex-col items-center justify-center gap-6 px-12 py-12 text-center',
        className,
      )}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <motion.h1
        className="text-balance text-4xl !leading-tight tracking-tight md:px-0 md:text-5xl"
        variants={itemVariants}
      >
        Monetize your software
      </motion.h1>
      <motion.p
        className="dark:text-polar-500 text-pretty text-lg !leading-tight text-gray-500 md:px-0"
        variants={itemVariants}
      >
        Turn your software into a business with 6 lines of code
      </motion.p>
      <motion.div
        className="mt-6 flex flex-row items-center gap-x-4"
        variants={itemVariants}
      >
        <GetStartedButton
          size="lg"
          text="Get Started"
          className="rounded-full bg-black font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
        />
      </motion.div>
    </motion.div>
  )
}
