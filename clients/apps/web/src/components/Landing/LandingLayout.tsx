'use client'

import { TopbarNavigation } from '@/components/Landing/TopbarNavigation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { usePostHog } from '@/hooks/posthog'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { AuthModal } from '../Auth/AuthModal'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="dark:bg-polar-950 relative flex flex-col gap-32 bg-gray-50 md:w-full md:flex-1 md:items-center">
      <div className="flex flex-col gap-y-2 md:w-full">
        <LandingPageTopbar />
        <LandingPageDesktopNavigation />
        <div className="dark:bg-polar-950 relative flex flex-col px-4 md:w-full md:px-0">
          {children}
          <LandingPageFooter />
        </div>
      </div>
    </div>
  )
}

const NavLink = ({
  href,
  children,
  isActive: _isActive,
}: {
  href: string
  children: React.ReactNode
  isActive?: (pathname: string) => boolean
}) => {
  const pathname = usePathname()
  const isActive = _isActive ? _isActive(pathname) : pathname.startsWith(href)
  const isExternal = href.startsWith('http')

  return (
    <Link
      href={href}
      target={isExternal ? '_blank' : undefined}
      prefetch
      className={twMerge(
        'dark:text-polar-500 flex items-center gap-x-2 text-gray-500 transition-colors hover:text-black dark:hover:text-white',
        isActive && 'text-black dark:text-white',
      )}
    >
      {children}
    </Link>
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
    <div className="dark:text-polar-50 hidden w-full flex-col items-center gap-12 py-12 md:flex">
      <div className="relative flex w-full flex-row items-center justify-between md:max-w-3xl xl:max-w-7xl">
        <BrandingMenu logoVariant="logotype" size={100} />

        <ul className="absolute left-1/2 mx-auto flex -translate-x-1/2 flex-row gap-x-6 font-medium">
          <li>
            <NavLink href="/" isActive={(pathname) => pathname === '/'}>
              Features
            </NavLink>
          </li>
          <li>
            <NavLink href="https://docs.polar.sh">Docs</NavLink>
          </li>
          <li>
            <NavLink href="/company">Company</NavLink>
          </li>
          <li>
            <NavLink href="/blog">Blog</NavLink>
          </li>
        </ul>

        <Button
          onClick={onLoginClick}
          className="rounded-full"
          variant="secondary"
        >
          Log In
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

const LandingPageTopbar = () => {
  const posthog = usePostHog()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
    showModal()
  }

  return (
    <div className="z-30 flex w-full flex-row items-center justify-between px-6 py-6 md:hidden md:px-12">
      <TopbarNavigation />
      <BrandingMenu
        className="ml-2 mt-1 md:hidden"
        logoVariant="logotype"
        size={80}
      />
      <div className="flex flex-row items-center gap-x-4">
        <Button
          onClick={onLoginClick}
          className="rounded-full"
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
      className="flex w-full flex-col items-center"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Footer />
    </motion.div>
  )
}
