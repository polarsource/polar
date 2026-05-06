'use client'
import { Box } from '@polar-sh/orbit/Box'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ComponentType, PropsWithChildren, ReactNode } from 'react'
import { Section } from '../Section'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8 } },
}

export interface FeaturePageHeaderProps {
  title: string
  description: string
  docsHref?: string
}

export const FeaturePageHeader = ({
  title,
  description,
  docsHref,
}: FeaturePageHeaderProps) => {
  return (
    <motion.section
      className="flex flex-col items-center gap-8 px-4 pb-4 text-center md:pb-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.h1
        className="font-display leading-tighter max-w-5xl text-4xl font-medium text-balance md:text-7xl"
        variants={itemVariants}
      >
        {title}
      </motion.h1>
      <motion.p
        className="dark:text-polar-300 max-w-2xl text-2xl text-balance text-gray-500"
        variants={itemVariants}
      >
        {description}
      </motion.p>
      <motion.div
        className="mt-4 flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-4"
        variants={itemVariants}
      >
        <GetStartedButton size="lg" text="Get Started" />
        {docsHref ? (
          <Link href={docsHref}>
            <Button variant="ghost" className="rounded-full" size="lg">
              View Documentation
            </Button>
          </Link>
        ) : null}
      </motion.div>
    </motion.section>
  )
}

export const FeaturePageGraphic = ({
  graphic: Graphic,
}: {
  graphic: ComponentType
}) => {
  return (
    <motion.div
      className="dark:bg-polar-900 flex w-full items-center justify-center rounded-sm bg-gray-50 p-8 md:p-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.4 }}
    >
      <Box aspectRatio="1 / 1" height="100%">
        <Graphic />
      </Box>
    </motion.div>
  )
}

export const FeaturePageIntro = ({ children }: PropsWithChildren) => {
  return (
    <motion.div
      className="dark:text-polar-200 mx-auto max-w-3xl text-lg leading-relaxed text-gray-700 md:text-xl"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      {children}
    </motion.div>
  )
}

export const FeatureSection = ({
  title,
  children,
}: PropsWithChildren<{ title: string }>) => {
  return (
    <motion.section
      className="mx-auto flex max-w-3xl flex-col gap-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={containerVariants}
    >
      <motion.h2
        className="text-2xl leading-snug md:text-3xl"
        variants={itemVariants}
      >
        {title}
      </motion.h2>
      <motion.div
        className="dark:text-polar-300 flex flex-col gap-y-5 text-lg leading-relaxed text-gray-600 md:text-xl [&_strong]:font-medium [&_strong]:text-gray-900 dark:[&_strong]:text-white"
        variants={itemVariants}
      >
        {children}
      </motion.div>
    </motion.section>
  )
}

export const FeatureSplit = ({
  title,
  description,
  bullets,
}: {
  title: string
  description: string
  bullets: { title: string; description: string }[]
}) => {
  return (
    <motion.section
      className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={containerVariants}
    >
      <Box display="flex" flexDirection="column" rowGap="xl">
        <motion.h2
          className="text-2xl leading-snug md:text-3xl"
          variants={itemVariants}
        >
          {title}
        </motion.h2>
        <motion.p
          className="dark:text-polar-300 text-lg leading-relaxed text-gray-600 md:text-xl"
          variants={itemVariants}
        >
          {description}
        </motion.p>
      </Box>
      <motion.ul
        className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200"
        variants={containerVariants}
      >
        {bullets.map((b, i) => (
          <motion.li
            key={i}
            className="flex flex-col gap-y-2 py-6 first:pt-0"
            variants={itemVariants}
          >
            <Box as="span" color="text-primary" className="text-lg">
              {b.title}
            </Box>
            <Box as="span" color="text-secondary" className="text-lg">
              {b.description}
            </Box>
          </motion.li>
        ))}
      </motion.ul>
    </motion.section>
  )
}

export const FeatureRichList = ({
  title,
  description,
  items,
}: {
  title: string
  description?: string
  items: { title: string; description: string }[]
}) => {
  return (
    <motion.section
      className="mx-auto flex max-w-3xl flex-col gap-y-10"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={containerVariants}
    >
      <Box display="flex" flexDirection="column" rowGap="l">
        <motion.h2
          className="text-2xl leading-snug md:text-3xl"
          variants={itemVariants}
        >
          {title}
        </motion.h2>
        {description ? (
          <motion.p
            className="dark:text-polar-300 text-lg leading-relaxed text-gray-600 md:text-xl"
            variants={itemVariants}
          >
            {description}
          </motion.p>
        ) : null}
      </Box>
      <motion.ul
        className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
        variants={containerVariants}
      >
        {items.map((it, i) => (
          <motion.li
            key={i}
            className="grid grid-cols-1 gap-2 py-6 md:grid-cols-[1fr_2fr] md:gap-10"
            variants={itemVariants}
          >
            <Box as="span" color="text-primary" className="text-lg">
              {it.title}
            </Box>
            <Box
              as="span"
              color="text-secondary"
              className="text-lg leading-relaxed"
            >
              {it.description}
            </Box>
          </motion.li>
        ))}
      </motion.ul>
    </motion.section>
  )
}

export interface FeatureCard {
  icon: ReactNode
  title: string
  description: string
}

export const FeatureCardGrid = ({ cards }: { cards: FeatureCard[] }) => {
  return (
    <motion.div
      className="grid grid-cols-1 gap-12 md:grid-cols-2"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={containerVariants}
    >
      {cards.map((c, i) => (
        <motion.div
          key={i}
          className="dark:border-polar-700 flex flex-col gap-y-6 border-gray-300"
          variants={itemVariants}
        >
          <Box color="text-primary">{c.icon}</Box>
          <Box display="flex" flexDirection="column" rowGap="s">
            <h3 className="text-xl">{c.title}</h3>
            <p className="dark:text-polar-400 text-lg text-gray-500">
              {c.description}
            </p>
          </Box>
        </motion.div>
      ))}
    </motion.div>
  )
}

export const FeatureCTA = ({
  title,
  description,
}: {
  title: string
  description: string
}) => {
  return (
    <motion.div
      className="dark:border-polar-700 flex flex-col items-center gap-y-8 border-t border-gray-300 pt-16 text-center"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={containerVariants}
    >
      <motion.h2 className="text-2xl md:text-3xl" variants={itemVariants}>
        {title}
      </motion.h2>
      <motion.p
        className="dark:text-polar-400 max-w-xl text-lg text-balance text-gray-500"
        variants={itemVariants}
      >
        {description}
      </motion.p>
      <motion.div variants={itemVariants}>
        <GetStartedButton size="lg" text="Get Started" />
      </motion.div>
    </motion.div>
  )
}

export const FeaturePageLayout = ({ children }: PropsWithChildren) => {
  return (
    <Box display="flex" flexDirection="column">
      <Section className="flex max-w-3xl! flex-col gap-y-16 pt-12 md:gap-y-24 md:pt-24">
        {children}
      </Section>
    </Box>
  )
}
