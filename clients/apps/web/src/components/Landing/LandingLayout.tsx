'use client'

import { TopbarNavigation } from '@/components/Landing/TopbarNavigation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { usePostHog } from '@/hooks/posthog'
import { motion } from 'framer-motion'
import Button from 'polarkit/components/ui/atoms/button'
import { PropsWithChildren } from 'react'
import { AuthModal } from '../Auth/AuthModal'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="dark:bg-[radial-gradient(800px_at_top,rgba(20,20,25,1)_0%,rgba(0,0,0,1)_100%] relative flex w-full flex-col items-center bg-gray-100 dark:bg-black">
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
    <div className="dark:bg-polar-800 shadow-3xl fixed inset-x-4 top-6 z-30 flex flex-row items-center justify-between rounded-full bg-white px-8 py-4 md:sticky md:inset-x-0 md:top-12 md:w-full md:max-w-2xl">
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
