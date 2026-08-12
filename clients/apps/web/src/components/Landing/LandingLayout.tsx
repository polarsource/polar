'use client'

import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import Footer from '@/components/Organization/Footer'
import { usePostHog } from '@/hooks/posthog'
import ArrowForward from '@mui/icons-material/ArrowForward'
import { Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import { motion } from 'motion/react'
import Link from 'next/link'
import { PropsWithChildren } from 'react'
import { AuthModal } from '../Auth/AuthModal'
import { useModal } from '../Modal/useModal'
import { LandingPageDesktopNavigation } from './DesktopNav'
import { NavLink } from './NavLink'

const StartupProgramBanner = () => (
  <Link href="/startup-program" prefetch>
    <Box
      display={{
        base: 'none',
        md: 'flex',
      }}
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      columnGap="s"
      paddingHorizontal="xl"
      paddingVertical="m"
      backgroundColor="background-secondary"
      color="text-primary"
    >
      <Text color="inherit">Introducing the Polar Startup Program</Text>
      <ArrowForward fontSize="inherit" />
    </Box>
  </Link>
)

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <div className="sticky top-0 z-30 flex w-full flex-col">
        <StartupProgramBanner />
        <LandingPageDesktopNavigation />
      </div>
      <div className="dark:bg-polar-950 relative flex flex-col overflow-x-clip bg-white px-0 md:w-full md:flex-1 md:items-center md:px-12">
        <div className="flex flex-col gap-y-2 md:w-full">
          <SidebarProvider className="absolute inset-0 flex flex-col items-start md:hidden">
            <LandingPageTopbar />
            <LandingPageMobileNavigation />
          </SidebarProvider>
          <div className="dark:bg-polar-950 relative flex flex-col px-6 pt-32 md:w-full md:px-0 md:pt-0">
            {children}
          </div>
          <LandingPageFooter />
        </div>
      </div>
    </>
  )
}

interface NavigationItem {
  title: string
  href: string
  isActive?: (pathname: string) => boolean
  target?: '_blank'
}

const mobileNavigationItems: NavigationItem[] = [
  {
    title: 'Overview',
    href: '/',
    isActive: (pathname) => pathname === '/',
  },
  {
    title: 'Documentation',
    href: 'https://polar.sh/docs',
    target: '_blank',
  },
  {
    title: 'Pricing',
    href: '/#pricing',
  },
  {
    title: 'Blog',
    href: '/blog',
  },
  {
    title: 'Company',
    href: '/company',
  },
  {
    title: 'Open Source',
    href: 'https://github.com/polarsource',
    target: '_blank',
  },
  {
    title: 'Polar on X',
    href: 'https://x.com/polar_sh',
    target: '_blank',
  },
]

const LandingPageMobileNavigation = () => {
  const sidebar = useSidebar()

  const posthog = usePostHog()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
    sidebar.toggleSidebar()
    showModal()
  }

  return (
    <>
      <Sidebar className="md:hidden">
        <SidebarHeader className="p-4">
          <Link href="/">
            <PolarLogotype logoVariant="icon" />
          </Link>
        </SidebarHeader>
        <SidebarContent className="flex flex-col gap-y-6 px-6 py-2">
          <div className="flex flex-col gap-y-1">
            {mobileNavigationItems.map((item) => {
              return (
                <NavLink
                  key={item.title}
                  className="text-xl tracking-tight"
                  isActive={item.isActive}
                  target={item.target}
                  href={item.href}
                  onClick={sidebar.toggleSidebar}
                >
                  {item.title}
                </NavLink>
              )
            })}
          </div>
          <NavLink
            href="#"
            onClick={onLoginClick}
            className="text-xl tracking-tight"
          >
            Login
          </NavLink>
        </SidebarContent>
      </Sidebar>
      <Modal
        title="Sign in"
        isShown={isModalShown}
        hide={hideModal}
        modalContent={<AuthModal />}
        className="lg:w-full lg:max-w-[480px]"
      />
    </>
  )
}

const LandingPageTopbar = () => {
  return (
    <div className="z-30 flex w-full flex-row items-center justify-between px-6 py-6 md:hidden md:px-12">
      <PolarLogotype
        className="mt-1 ml-2 md:hidden"
        logoVariant="logotype"
        size={100}
      />
      <SidebarTrigger className="md:hidden" />
    </div>
  )
}

const LandingPageFooter = () => {
  return (
    <motion.div
      initial="initial"
      className="relative flex w-full flex-col items-center"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Footer />
    </motion.div>
  )
}
