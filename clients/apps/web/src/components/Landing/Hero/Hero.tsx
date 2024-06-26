'use client'

import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { Section } from '@/components/Landing/Section'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { UserSignupType } from '@polar-sh/sdk'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Circles } from '../molecules/Circles'
import { MOCKED_PRODUCTS } from '../utils'

export const Hero = () => {
  const transition = {
    staggerChildren: 0.2,
  }

  const cardVariants = {
    visible: {
      opacity: 1,
      transition: {
        duration: 2,
      },
    },
    hidden: {
      opacity: 0,
    },
  }

  return (
    <Section
      className="flex w-full flex-col gap-4 md:flex-row md:items-center md:py-24"
      wrapperClassName="relative isolate overflow-hidden"
    >
      <Circles className="absolute inset-0 top-1/2 block -translate-y-1/2 text-black dark:hidden" />
      <Circles className="absolute inset-0 top-1/2 hidden -translate-y-1/2 text-white dark:block" />
      <div className="relative z-20 flex w-full flex-col gap-y-12 md:w-1/2">
        <div className="z-20 flex flex-col gap-y-16">
          <h1 className="text-5xl leading-snug text-gray-950 md:text-7xl md:leading-tight dark:text-white">
            Get paid coding on your passion
          </h1>
          <div className="flex flex-col">
            <p className="text-xl leading-relaxed">
              Polar is the best funding & monetization platform for developers.
              Leave VAT, sales tax & billing to us.
            </p>
          </div>
        </div>
        <div className="z-20 flex flex-col gap-y-8">
          <GithubLoginButton
            className="self-start"
            size="large"
            text="Continue with GitHub"
            userSignupType={UserSignupType.MAINTAINER}
            returnTo="/maintainer"
          />
          <p className="dark:text-polar-500 text-xs leading-normal text-gray-400">
            By using Polar you agree to our{' '}
            <Link
              className="dark:text-polar-300 text-blue-500"
              href="/legal/terms"
              target="_blank"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              className="dark:text-polar-300 text-blue-500"
              href="/legal/privacy"
              target="_blank"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
      <motion.div
        className="relative z-20 hidden h-fit w-1/2 gap-8 md:grid md:grid-cols-2"
        initial="hidden"
        animate="visible"
        transition={transition}
      >
        <motion.div className="h-full" variants={cardVariants}>
          <Link className="h-full" href="/products">
            <SubscriptionTierCard
              className="dark:bg-polar-950 shadow-3xl h-full w-full max-w-[280px]"
              subscriptionTier={{ ...MOCKED_PRODUCTS[1] }}
            />
          </Link>
        </motion.div>
        <motion.div variants={cardVariants}></motion.div>

        <motion.div className="col-span-2" variants={cardVariants}>
          <Link className="h-full" href="/issue-funding">
            <picture>
              <source
                media="(prefers-color-scheme: dark)"
                srcSet={`/assets/landing/fund_dark.svg`}
              />
              <img
                className="dark:border-polar-700 shadow-3xl rounded-2xl border border-gray-100"
                srcSet={`/assets/landing/fund.svg`}
                alt="Polar crowdfunding badge embedded on a GitHub issue"
              />
            </picture>
          </Link>
        </motion.div>
      </motion.div>
    </Section>
  )
}
