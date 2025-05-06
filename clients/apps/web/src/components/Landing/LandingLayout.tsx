'use client'

import { TopbarNavigation } from '@/components/Landing/TopbarNavigation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { usePostHog } from '@/hooks/posthog'
import { ArrowOutward, KeyboardArrowRightOutlined } from '@mui/icons-material'
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
    <div className="dark:bg-polar-950 relative flex flex-row bg-gray-50">
      <LandingPageDesktopNavigation />
      <div className="flex flex-col gap-32 md:w-full md:flex-1 md:items-center md:pt-16">
        <div className="flex flex-col gap-y-2 md:w-full md:max-w-3xl xl:max-w-7xl">
          <LandingPageTopbar />
          <div className="dark:bg-polar-950 relative flex w-screen flex-col px-4 md:w-full md:px-0">
            {children}
            <LandingPageFooter />
          </div>
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
      {isExternal && (
        <span>
          <ArrowOutward fontSize="inherit" />
        </span>
      )}
    </Link>
  )
}

const LandingPageDesktopNavigation = () => {
  return (
    <div className="dark:text-polar-50 sticky top-0 hidden h-full w-fit flex-shrink-0 flex-col justify-between gap-y-12 p-12 md:flex">
      <div className="flex flex-col gap-y-12 text-base font-medium leading-tight tracking-[-0.01em]">
        <BrandingMenu logoVariant="logotype" size={100} />

        <div className="flex flex-col gap-y-12">
          <ul className="flex flex-col gap-y-3">
            <li>
              <NavLink href="/" isActive={(pathname) => pathname === '/'}>
                Features
              </NavLink>
            </li>
            <li>
              <NavLink href="https://docs.polar.sh">Docs</NavLink>
            </li>
            <li>
              <NavLink href="https://github.com/polarsource">
                Open Source
              </NavLink>
            </li>
            <li>
              <NavLink href="/company">Company</NavLink>
            </li>
            <li>
              <NavLink href="/blog">Blog</NavLink>
            </li>
          </ul>
          <ul className="flex flex-col gap-y-3">
            <li>
              <NavLink href="/login">
                <span>Login</span>
                <KeyboardArrowRightOutlined fontSize="inherit" />
              </NavLink>
            </li>
            <li>
              <NavLink href="/login">
                <span>Get Started</span>
                <KeyboardArrowRightOutlined fontSize="inherit" />
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
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
    <div className="z-30 flex w-full flex-row items-center justify-between px-6 py-6 md:hidden md:max-w-7xl md:px-12">
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
      <Footer wide />
    </motion.div>
  )
}
