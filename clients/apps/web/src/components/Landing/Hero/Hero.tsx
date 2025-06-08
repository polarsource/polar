'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import Image from 'next/image'
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
        'dark:border-polar-800 relative flex flex-col items-center justify-center gap-12 overflow-hidden rounded-3xl px-6 py-16 text-center md:py-24 dark:border',
        className,
      )}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="absolute inset-0 -z-10">
        <Image
          src="/assets/landing/hero.jpg"
          alt="Hero background"
          className="object-cover"
          width={1920}
          height={1080}
        />
      </div>
      <motion.h1
        className="text-balance text-5xl !leading-tight tracking-tight text-gray-950 md:px-0 md:text-7xl dark:text-white"
        variants={itemVariants}
      >
        Payment infrastructure for the 21st century
      </motion.h1>
      <motion.p
        className="text-pretty text-2xl leading-relaxed md:px-0"
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
