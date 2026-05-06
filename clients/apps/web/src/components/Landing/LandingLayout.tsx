'use client'
import { Box } from '@polar-sh/orbit/Box'

import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import Footer from '@/components/Organization/Footer'
import { usePostHog } from '@/hooks/posthog'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ComponentProps, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { AuthModal } from '../Auth/AuthModal'
import GetStartedButton from '../Auth/GetStartedButton'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { NavPopover, NavPopoverSection } from './NavPopover'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <Box
      backgroundColor="background-primary"
      position="relative"
      display="flex"
      flexDirection="column"
      paddingHorizontal={{
        base: 'none',
        md: 'l',
      }}
      width={{
        md: '100%',
      }}
      flex={{
        md: 1,
      }}
      alignItems={{
        md: 'center',
      }}
      className="overflow-x-clip"
    >
      <Box
        display="flex"
        flexDirection="column"
        rowGap="s"
        width={{
          md: '100%',
        }}
      >
        <LandingPageDesktopNavigation />
        <SidebarProvider className="absolute inset-0 flex flex-col items-start md:hidden">
          <LandingPageTopbar />
          <LandingPageMobileNavigation />
        </SidebarProvider>
        <Box
          position="relative"
          display="flex"
          flexDirection="column"
          paddingHorizontal={{
            base: 'l',
            md: 'none',
          }}
          width={{
            md: '100%',
          }}
          paddingTop={{
            md: 'none',
          }}
          className="dark:bg-polar-950 pt-32"
        >
          {children}
        </Box>
        <LandingPageFooter />
      </Box>
    </Box>
  )
}

const NavLink = ({
  href,
  className,
  children,
  isActive: _isActive,
  target,
  ...props
}: ComponentProps<typeof Link> & {
  isActive?: (pathname: string) => boolean
}) => {
  const pathname = usePathname()
  const isActive = _isActive
    ? _isActive(pathname)
    : pathname.startsWith(href.toString())
  const isExternal = href.toString().startsWith('http')

  return (
    <Link
      href={href}
      target={isExternal ? '_blank' : target}
      prefetch
      className={twMerge(
        'dark:text-polar-500 -m-1 flex items-center gap-x-2 p-1 text-gray-500 transition-colors hover:text-black dark:hover:text-white',
        isActive && 'text-black dark:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
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
          <Box display="flex" flexDirection="column" rowGap="xs">
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
          </Box>
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

const LandingPageDesktopNavigation = () => {
  const posthog = usePostHog()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()
  const pathname = usePathname()

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
    showModal()
  }

  const featuresSections: NavPopoverSection[] = [
    {
      items: [
        {
          href: '/features/usage-billing',
          label: 'Usage Billing',
          subtitle: 'Meter and bill any event',
        },
        {
          href: '/features/subscriptions',
          label: 'Subscriptions',
          subtitle: 'Recurring revenue on autopilot',
        },
        {
          href: '/features/seats',
          label: 'Seats',
          subtitle: 'Pricing that scales with teams',
        },
        {
          href: '/features/credits',
          label: 'Credits',
          subtitle: 'Prepay and draw down over time',
        },
        {
          href: '/features/trials',
          label: 'Trials',
          subtitle: 'Trials that convert themselves',
        },
        {
          href: '/features/discounts',
          label: 'Discounts',
          subtitle: 'Promo codes & recurring deals',
        },
        {
          href: '/features/cost-insights',
          label: 'Cost Insights',
          subtitle: 'Cost, profit, and LTV per customer',
        },
        {
          href: '/features/finance',
          label: 'Finance',
          subtitle: 'Balance, ledger, fees, payouts',
        },
        {
          href: '/features/merchant-of-record',
          label: 'Merchant of Record',
          subtitle: 'Global tax compliance, on us',
        },
      ],
    },
  ]

  const docsSections: NavPopoverSection[] = [
    {
      title: 'Integrate',
      items: [
        {
          href: '/docs/integrate/sdk/adapters/nextjs',
          label: 'Next.js',
          target: '_blank',
        },
        {
          href: '/docs/integrate/sdk/adapters/better-auth',
          label: 'Better Auth',
          target: '_blank',
        },
        {
          href: '/docs/integrate/sdk/adapters/hono',
          label: 'Hono',
          target: '_blank',
        },
        {
          href: '/docs/integrate/sdk/adapters/laravel',
          label: 'Laravel',
          target: '_blank',
        },
        {
          href: '/docs/integrate/sdk/adapters/hono',
          target: '_blank',
          label: 'All 13 Adapters',
        },
      ],
    },
    {
      title: 'Features',
      items: [
        {
          href: '/docs/features/products',
          label: 'Documentation Portal',
          target: '_blank',
          subtitle: 'Get started with Polar',
        },
        {
          href: '/docs/features/products',
          label: 'Products & Subscriptions',
          target: '_blank',
          subtitle: 'Flexible pricing models',
        },
        {
          href: '/docs/features/checkout/links',
          target: '_blank',
          label: 'Checkouts',
          subtitle: 'Checkout Links & Embeds',
        },
        {
          href: '/docs/features/usage-based-billing/introduction',
          label: 'Usage Billing',
          subtitle: 'Ingestion-based Billing',
        },
        {
          href: '/docs/features/benefits',
          label: 'Benefits',
          subtitle: 'Entitlement Automation',
        },
        {
          href: '/docs/features/finance/payouts',
          label: 'Finance & Payouts',
          subtitle: 'Detailed financial insights',
          target: '_blank',
        },
      ],
    },
  ]

  return (
    <Box
      backgroundColor="background-primary"
      position="sticky"
      top={0}
      zIndex={10}
      display={{
        base: 'none',
        md: 'flex',
      }}
      width="100%"
      flexDirection="column"
      alignItems="center"
      gap="3xl"
      paddingVertical="2xl"
      color="text-primary"
    >
      <Box
        position="relative"
        display="flex"
        width="100%"
        flexDirection="row"
        alignItems="center"
        justifyContent="between"
        maxWidth={{
          lg: '1280px',
        }}
      >
        <Link href="/">
          <PolarLogotype logoVariant="logotype" size={120} />
        </Link>

        <Box
          as="ul"
          position="absolute"
          left="50%"
          marginHorizontal="auto"
          display="flex"
          flexDirection="row"
          columnGap="2xl"
          className="-translate-x-1/2 font-medium"
        >
          <Box as="li">
            <NavPopover
              trigger="Features"
              sections={featuresSections}
              isActive={pathname.startsWith('/features')}
            />
          </Box>
          <Box as="li">
            <NavPopover trigger="Docs" sections={docsSections} layout="flex" />
          </Box>
          <Box as="li">
            <NavLink href="/blog">Blog</NavLink>
          </Box>
          <Box as="li">
            <NavLink href="/company">Company</NavLink>
          </Box>
        </Box>

        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          columnGap="l"
        >
          <Button
            onClick={onLoginClick}
            variant="ghost"
            className="rounded-full"
          >
            Sign in
          </Button>
          <GetStartedButton size="default" />
        </Box>
      </Box>
      <Modal
        title="Sign in"
        isShown={isModalShown}
        hide={hideModal}
        modalContent={<AuthModal />}
        className="lg:w-full lg:max-w-[480px]"
      />
    </Box>
  )
}

const LandingPageTopbar = () => {
  return (
    <Box
      zIndex={30}
      display={{
        base: 'flex',
        md: 'none',
      }}
      width="100%"
      flexDirection="row"
      alignItems="center"
      justifyContent="between"
      paddingHorizontal={{
        base: 'xl',
        md: '3xl',
      }}
      paddingVertical="xl"
    >
      <PolarLogotype
        className="mt-1 ml-2 md:hidden"
        logoVariant="logotype"
        size={100}
      />
      <SidebarTrigger className="md:hidden" />
    </Box>
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
