'use client'

import { TopbarNavigation } from '@/components/Landing/TopbarNavigation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { usePostHog } from '@/hooks/posthog'
import { ArrowOutward } from '@mui/icons-material'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { PropsWithChildren } from 'react'
import { AuthModal } from '../Auth/AuthModal'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="relative flex w-screen flex-col items-center">
      <div className="flex w-fit flex-col gap-32 md:flex-row md:pt-16">
        <LandingPageTopbar />
        <LandingPageDesktopNavigation />
        <div className="dark:bg-polar-950 relative flex w-full max-w-6xl flex-col bg-gray-100">
          {children}
          <LandingPageFooter />
        </div>
      </div>
    </div>
  )
}

const LandingPageDesktopNavigation = () => {
  const posthog = usePostHog()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
    showModal()
  }

  return (
    <div className="dark:text-polar-50 sticky top-16 hidden h-fit w-fit flex-shrink-0 flex-col gap-y-8 text-lg font-medium leading-tight tracking-[-0.01em] md:flex">
      <BrandingMenu logoVariant="logotype" size={100} />

      <ul className="flex flex-col gap-y-2">
        <li>
          <Link href="/pricing">Billing</Link>
        </li>
        <li>
          <Link href="/pricing">Usage Billing</Link>
        </li>
        <li>
          <Link href="/pricing">Entitlements</Link>
        </li>
        <li>
          <Link href="/pricing">Merchant of Record</Link>
        </li>
        <li>
          <Link href="/pricing">Pricing</Link>
        </li>
      </ul>

      <ul className="flex flex-col gap-y-2">
        <li className="flex items-baseline gap-x-2">
          <Link href="/pricing">Docs</Link>
          <span className="text-[.9rem]">
            <ArrowOutward fontSize="inherit" />
          </span>
        </li>
        <li>
          <Link href="/pricing">GitHub</Link>
        </li>
        <li>
          <Link href="/pricing">Blog</Link>
        </li>
        <li>
          <Link href="/pricing">Careers</Link>
        </li>
        <li>
          <Link href="/pricing">Company</Link>
        </li>
      </ul>

      <ul className="flex flex-col gap-y-2">
        <li>
          <Link href="/pricing">Sign in</Link>
        </li>
        <li>
          <Link href="/pricing">Sign up</Link>
        </li>
      </ul>

      <Modal
        isShown={isModalShown}
        hide={hideModal}
        modalContent={<AuthModal />}
        className="lg:w-full lg:max-w-[480px]"
      />
    </div>
  )
}

const LandingPageTopbar = () => {
  const posthog = usePostHog()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
    showModal()
  }

  return (
    <div className="z-30 flex w-full flex-row items-center justify-between px-8 py-6 md:hidden md:max-w-7xl md:px-12">
      <TopbarNavigation />
      <BrandingMenu
        className="ml-2 mt-1 md:hidden"
        logoVariant="logotype"
        size={80}
      />
      <div className="flex flex-row items-center gap-x-4">
        <Button
          onClick={onLoginClick}
          className="text-black dark:text-white"
          variant="secondary"
        >
          Log in
        </Button>
      </div>
      <Modal
        isShown={isModalShown}
        hide={hideModal}
        modalContent={<AuthModal />}
        className="lg:w-full lg:max-w-[480px]"
      />
    </div>
  )
}

const LandingPageFooter = () => {
  return (
    <motion.div
      initial="initial"
      className="flex"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Footer />
    </motion.div>
  )
}
