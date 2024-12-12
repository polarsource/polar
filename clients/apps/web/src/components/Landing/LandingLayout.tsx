'use client'

import { TopbarNavigation } from '@/components/Landing/TopbarNavigation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { usePostHog } from '@/hooks/posthog'
import { ChevronRightOutlined } from '@mui/icons-material'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { PropsWithChildren } from 'react'
import { AuthModal } from '../Auth/AuthModal'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <Link
        href="/docs/developers/sdk/polar-for-framer"
        className="dark:bg-polar-900 hidden flex-row items-center justify-center gap-x-4 bg-white p-4 text-center text-sm text-black transition-opacity duration-300 hover:opacity-50 md:flex dark:text-white"
      >
        <svg
          fill="currentColor"
          width="14px"
          height="14px"
          viewBox="0 0 24 24"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4 0h16v8h-8zM4 8h8l8 8H4zM4 16h8v8z" />
        </svg>
        <div className="flex flex-row items-center gap-x-1">
          <span>
            Introducing Polar for Framer - the simplest way to sell digital
            products on your site
          </span>
          <ChevronRightOutlined fontSize="small" />
        </div>
      </Link>
      <div className="dark:bg-[radial-gradient(800px_at_top,rgba(20,20,25,1)_0%,rgba(0,0,0,1)_100%] relative flex w-full flex-col items-center bg-gray-100 dark:bg-black">
        <LandingPageTopbar />
        {children}
        <LandingPageFooter />
      </div>
    </>
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
    <div className="dark:bg-polar-800 shadow-3xl fixed inset-x-4 top-6 z-30 flex flex-row items-center justify-between rounded-full bg-white px-8 py-4 md:sticky md:inset-x-0 md:top-16 md:w-full md:max-w-2xl">
      <TopbarNavigation />
      <BrandingMenu
        className="mt-1 hidden md:block"
        size={70}
        logoVariant="logotype"
      />
      <BrandingMenu
        className="ml-2 mt-1 md:hidden"
        logoVariant="logotype"
        size={70}
      />
      <div className="flex flex-row items-center gap-x-4">
        <Button onClick={onLoginClick} variant="secondary">
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
      className="flex w-full"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Footer wide={true} />
    </motion.div>
  )
}
