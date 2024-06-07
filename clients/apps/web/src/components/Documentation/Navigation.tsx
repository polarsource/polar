'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { CommandPaletteTrigger } from '@/components/CommandPalette/CommandPaletteTrigger'
import { useModal } from '@/components/Modal/useModal'
import {
  ApiOutlined,
  ArrowForward,
  CloseOutlined,
  DescriptionOutlined,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ShortTextOutlined,
  SpaceDashboardOutlined,
} from '@mui/icons-material'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { Separator } from 'polarkit/components/ui/separator'
import { PropsWithChildren, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useSections } from './APINavigation'
import { NaviagtionItem } from './NavigationItem'
import { SearchPalette } from './SearchPalette'

export const Navigation = () => {
  const pathname = usePathname()

  const shouldRenderOverviewSections = pathname.includes('/docs/overview')
  const shouldRenderAPISections = pathname.includes('/docs/api-reference/')

  return (
    <div className="flex flex-col gap-y-8">
      {shouldRenderOverviewSections && (
        <>
          <OverviewSections />
          <FAQSections />
        </>
      )}
      {shouldRenderAPISections && (
        <>
          <APISections />
          <APIReferenceSections />
        </>
      )}
    </div>
  )
}

export const DocumentationPageSidebar = () => {
  const { isShown, show, hide } = useModal()

  return (
    <div className="flex w-full flex-shrink-0 flex-col gap-y-12 md:w-60">
      <div className="hidden flex-col gap-y-12 md:flex">
        <CommandPaletteTrigger onClick={show} />
      </div>
      <ul className="flex flex-col">
        <li>
          <NaviagtionItem
            icon={<SpaceDashboardOutlined fontSize="inherit" />}
            href="/docs/overview"
          >
            Overview
          </NaviagtionItem>
        </li>
        <li>
          <NaviagtionItem
            icon={<ApiOutlined fontSize="inherit" />}
            href="/docs/api"
          >
            API Reference
          </NaviagtionItem>
        </li>
        <li>
          <NaviagtionItem
            icon={<DescriptionOutlined fontSize="inherit" />}
            href="/docs/guides"
          >
            Guides
          </NaviagtionItem>
        </li>
      </ul>
      <Separator />
      <Navigation />

      <SearchPalette isShown={isShown} show={show} hide={hide} />
    </div>
  )
}

export const MobileNav = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const header = (
    <div className="dark:bg-polar-900 dark:border-polar-700 fixed left-0 right-0 top-0 z-50 flex flex-row items-center justify-between border-b border-gray-200 bg-white p-4 md:hidden">
      <a href="/" className="flex flex-shrink-0 flex-row items-center gap-x-3">
        <LogoIcon className="h-10 w-10 text-blue-500 dark:text-blue-400" />
        <span className="font-medium">Documentation</span>
      </a>

      <div
        className="dark:text-polar-200 flex flex-row items-center justify-center text-gray-700"
        onClick={() => setMobileNavOpen((toggle) => !toggle)}
      >
        {mobileNavOpen ? <CloseOutlined /> : <ShortTextOutlined />}
      </div>
    </div>
  )

  return mobileNavOpen ? (
    <div className="flex h-full flex-col px-8 py-4">
      <div className="dark:bg-polar-900 bg-gray-75 relative flex flex-row items-center justify-between">
        {header}
      </div>
      <div className="z-10 flex h-full flex-col pt-8">
        <DocumentationPageSidebar />
      </div>
    </div>
  ) : (
    header
  )
}

const OverviewSections = () => {
  return (
    <>
      <div className="flex flex-col">
        <NaviagtionItem href="/docs/overview/donations">
          Donations
        </NaviagtionItem>
        <NaviagtionItem href="/docs/overview/benefits">Benefits</NaviagtionItem>
        <NaviagtionItem href="/docs/overview/subscriptions">
          Subscriptions
        </NaviagtionItem>
        <NaviagtionItem href="/docs/overview/newsletters">
          Newsletters
        </NaviagtionItem>
        <NaviagtionItem href="/docs/overview/ads">Ads</NaviagtionItem>
        <NaviagtionItem href="/docs/overview/payments-taxes">
          Payments & Taxes
        </NaviagtionItem>
        <NaviagtionItem href="/docs/overview/support">Support</NaviagtionItem>
      </div>

      <div className="flex flex-col gap-y-4">
        <h2 className="font-medium">Issue Funding</h2>
        <div className="flex flex-col">
          <NaviagtionItem
            href="/docs/overview/issue-funding/overview"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Overview
          </NaviagtionItem>
          <NaviagtionItem
            href="/docs/overview/issue-funding/getting-started"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Getting Started
          </NaviagtionItem>
          <NaviagtionItem
            href="/docs/overview/issue-funding/workflow"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Workflow
          </NaviagtionItem>
          <NaviagtionItem
            href="/docs/overview/issue-funding/promote"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Promote
          </NaviagtionItem>
          <NaviagtionItem
            href="/docs/overview/issue-funding/reward-contributors"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Reward Contributors
          </NaviagtionItem>
        </div>
      </div>
    </>
  )
}

const FAQSections = () => {
  return (
    <div className="flex flex-col gap-y-4">
      <h2 className="font-medium">FAQ</h2>
      <div className="flex flex-col">
        <NaviagtionItem
          href="/docs/overview/faq/overview"
          icon={<ArrowForward fontSize="inherit" />}
        >
          Overview
        </NaviagtionItem>
        <NaviagtionItem
          href="/docs/overview/faq/for-maintainers"
          icon={<ArrowForward fontSize="inherit" />}
        >
          For Maintainers
        </NaviagtionItem>
        <NaviagtionItem
          href="/docs/overview/faq/for-backers"
          icon={<ArrowForward fontSize="inherit" />}
        >
          For Backers
        </NaviagtionItem>
        <NaviagtionItem
          href="/docs/overview/faq/for-contributors"
          icon={<ArrowForward fontSize="inherit" />}
        >
          For Contributors
        </NaviagtionItem>
      </div>
    </div>
  )
}

const APISections = () => {
  return (
    <div className="flex flex-col">
      <NaviagtionItem href="/docs/api-reference/introduction">
        Introduction
      </NaviagtionItem>
      <NaviagtionItem href="/docs/api-reference/polar-sdk">
        Polar SDK
      </NaviagtionItem>
      <NaviagtionItem href="/docs/api-reference/github-actions">
        GitHub Actions
      </NaviagtionItem>
    </div>
  )
}

const APIReferenceSections = () => {
  const sections = useSections()

  return (
    <div className="flex flex-col gap-y-6">
      <h3>API Endpoints</h3>
      <div className="flex flex-col gap-y-5">
        {sections.map((section) => (
          <CollapsibleSection key={section.name} title={section.name}>
            {section.endpoints.map((endpoint) => (
              <NaviagtionItem
                key={endpoint.path + endpoint.method}
                className="m-0 bg-transparent p-0 text-sm dark:bg-transparent"
                href={`/docs/api-reference/${endpoint.path}/${endpoint.method}`}
                active={(pathname) => {
                  const hasTrailingSlash = endpoint.path.endsWith('/')
                  const withTrailingSlash = hasTrailingSlash
                    ? endpoint.path
                    : `${endpoint.path}/`

                  return pathname.includes(
                    `${withTrailingSlash}${endpoint.method}`,
                  )
                }}
              >
                <div className="flex w-full flex-row items-center justify-between gap-x-4">
                  {endpoint.name}
                  <span className="dark:bg-polar-800 rounded-sm bg-gray-200/50 px-1.5 py-0 font-mono text-[10px] font-normal uppercase">
                    {endpoint.method}
                  </span>
                </div>
              </NaviagtionItem>
            ))}
          </CollapsibleSection>
        ))}
      </div>
    </div>
  )
}

const CollapsibleSection = ({
  title,
  children,
}: PropsWithChildren<{ title: string }>) => {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const active = pathname.includes(title.toLowerCase().replaceAll(' ', '-'))

  useEffect(() => {
    setIsOpen(active)
  }, [active])

  return (
    <div
      className={twMerge(
        'hover:bg-gray-75 group -mx-4 -my-2 flex flex-col gap-y-2 rounded-xl px-4 py-2 transition-colors duration-100 dark:border dark:border-transparent',
        isOpen || active
          ? 'bg-gray-75 dark:border-polar-700 dark:bg-transparent'
          : 'dark:hover:bg-polar-800',
      )}
    >
      <div
        className="flex cursor-pointer flex-row items-center justify-between"
        onClick={() => setIsOpen((open) => !open)}
      >
        <h2
          className={twMerge(
            'dark:text-white0 dark:group-hover:text-polar-50 text-sm capitalize text-gray-500 transition-colors group-hover:text-black',
            (isOpen || active) && 'text-black dark:text-white',
          )}
        >
          {title}
        </h2>
        <span className="dark:text-white0 text-gray-500">
          <AnimatePresence mode="popLayout">
            {isOpen ? (
              <motion.div
                key={0}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <KeyboardArrowUp fontSize="small" />
              </motion.div>
            ) : (
              <motion.div
                key={1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <KeyboardArrowDown fontSize="small" />
              </motion.div>
            )}
          </AnimatePresence>
        </span>
      </div>
      {isOpen && <div className="flex flex-col gap-y-4 py-2">{children}</div>}
    </div>
  )
}
