'use client'

import { TopbarNavigation } from '@/components/Landing/TopbarNavigation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { usePostHog } from '@/hooks/posthog'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import { PropsWithChildren } from 'react'
import { AuthModal } from '../Auth/AuthModal'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="dark:bg-polar-950 relative flex w-full flex-col items-center bg-gray-100">
      <LandingPageTopbar />
      {children}
      <LandingPageFooter />
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
    <div className="z-30 flex w-full flex-row items-center justify-between px-8 py-6 md:max-w-7xl">
      <TopbarNavigation />
      <BrandingMenu
        className="mt-1 hidden md:block"
        size={80}
        logoVariant="logotype"
      />
      <BrandingMenu
        className="ml-2 mt-1 md:hidden"
        logoVariant="logotype"
        size={80}
      />
      <div className="flex flex-row items-center gap-x-4">
        <Button onClick={onLoginClick} variant="ghost">
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
