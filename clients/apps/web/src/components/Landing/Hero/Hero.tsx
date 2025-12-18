'use client'

import { motion } from 'framer-motion'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

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

export type HeroProps = PropsWithChildren<{
  className?: string
  title: string
  description: string
}>

export const Hero = ({
  className,
  title,
  description,
  children,
}: HeroProps) => {
  return (
    <motion.div
      className={twMerge(
        'relative flex flex-col items-center justify-center gap-4 px-4 pt-8 text-center md:pt-12',
        className,
      )}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <motion.h1
        className="text-5xl leading-tight! tracking-tight text-balance md:px-0 md:text-7xl"
        variants={itemVariants}
      >
        {title}
      </motion.h1>
      <motion.p
        className="dark:text-polar-500 max-w-2xl text-center text-2xl leading-relaxed! text-balance text-gray-500"
        variants={itemVariants}
      >
        {description}
      </motion.p>
      <motion.div
        className="mt-6 flex flex-col items-center gap-4 md:flex-row md:gap-6"
        variants={itemVariants}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
