'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'

export const Hero = () => {
  const [slug, setSlug] = useState('')

  const slugify = useCallback(
    (str: string) =>
      str
        .toLowerCase()
        .replace(/[\s_-]+/g, '-')
        .trim(),
    [],
  )

  const isPhone = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined')
      return false

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(
      navigator.userAgent,
    )
  }, [])

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
      className="flex w-full flex-col items-center justify-center gap-8 text-center"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <motion.h1
        className="max-w-2xl text-pretty text-4xl !leading-tight text-gray-950 md:text-6xl dark:text-white"
        variants={itemVariants}
      >
        Payment infrastructure for the{' '}
        <span className="dark:text-polar-500 text-gray-400">21st century</span>
      </motion.h1>
      <motion.p
        className="text-pretty text-xl leading-relaxed"
        variants={itemVariants}
      >
        The modern way to sell your SaaS and digital products
      </motion.p>
      <motion.div
        className="flex flex-row items-center gap-x-4"
        variants={itemVariants}
      >
        <form
          className="dark:bg-polar-900 shadow-3xl dark:border-polar-700 hidden flex-row items-center gap-x-2 rounded-3xl border border-transparent bg-gray-50 py-2 pl-6 pr-2 md:flex"
          role="form"
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <div className="flex flex-row items-center gap-x-0.5">
            <span className="md:text-xl">polar.sh/</span>
            <input
              autoFocus={!isPhone}
              className="dark:placeholder:text-polar-500 w-44 border-none border-transparent bg-transparent p-0 placeholder:text-gray-400 focus:border-transparent focus:ring-0 md:text-xl"
              placeholder="my-app"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </div>
          <GetStartedButton
            type="submit"
            orgSlug={slug}
            size="lg"
            text="Get Started"
            className="bg-black font-medium text-white hover:bg-gray-900 dark:bg-white dark:text-black"
          />
        </form>

        <div className="flex flex-col gap-y-2 md:hidden">
          <div
            className="dark:bg-polar-800 dark:border-polar-700 shadow-3xl flex flex-row items-center rounded-xl border bg-gray-50 px-4 py-2"
            role="form"
          >
            <span className="md:text-xl">polar.sh/</span>
            <input
              autoFocus={!isPhone}
              className="dark:placeholder:text-polar-500 w-44 border-none border-transparent bg-transparent p-0 placeholder:text-gray-400 focus:border-transparent focus:ring-0 md:text-xl"
              placeholder="my-app"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </div>
          <GetStartedButton
            fullWidth
            orgSlug={slug}
            size="lg"
            text="Get Started"
            className="bg-black font-medium text-white hover:bg-gray-900 dark:bg-white dark:text-black"
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
