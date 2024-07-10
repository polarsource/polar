'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { CommandPaletteTrigger } from '@/components/CommandPalette/CommandPaletteTrigger'
import { useModal } from '@/components/Modal/useModal'
import {
  ApiOutlined,
  ArrowForward,
  CloseOutlined,
  DescriptionOutlined,
  FavoriteBorderOutlined,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ShortTextOutlined,
  SpaceDashboardOutlined,
  SupportOutlined,
} from '@mui/icons-material'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { OpenAPIV3_1 } from 'openapi-types'
import { Separator } from 'polarkit/components/ui/separator'
import { PropsWithChildren, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { NavigationItem } from './NavigationItem'
import { SearchPalette } from './SearchPalette'
import {
  APISection,
  HttpMethod,
  getAPISections,
  isFeaturedEndpoint,
  isNotFeaturedEndpoint,
} from './openapi'

const NavigationSection = ({
  title,
  children,
  defaultOpened = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpened: boolean
}) => {
  return (
    <CollapsibleSection
      title={title}
      defaultOpened={defaultOpened}
      isSubMenu={false}
    >
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col">{children}</div>
      </div>
    </CollapsibleSection>
  )
}

const OverviewSections = () => {
  return (
    <>
      <div className="flex flex-col">
        <NavigationItem href="/docs/donations">Donations</NavigationItem>
        <NavigationItem href="/docs/benefits">Benefits</NavigationItem>
        <NavigationItem href="/docs/subscriptions">
          Subscriptions
        </NavigationItem>
        <NavigationItem href="/docs/newsletters">Newsletters</NavigationItem>
        <NavigationItem href="/docs/ads">Ads</NavigationItem>
        <NavigationItem href="/docs/payments-taxes">
          Payments & Taxes
        </NavigationItem>
      </div>

      <NavigationSection title="Issue Funding" defaultOpened={true}>
        <NavigationItem
          href="/docs/issue-funding/overview"
          icon={<ArrowForward fontSize="inherit" />}
        >
          Overview
        </NavigationItem>
        <NavigationItem
          href="/docs/issue-funding/getting-started"
          icon={<ArrowForward fontSize="inherit" />}
        >
          Getting Started
        </NavigationItem>
        <NavigationItem
          href="/docs/issue-funding/workflow"
          icon={<ArrowForward fontSize="inherit" />}
        >
          Workflow
        </NavigationItem>
        <NavigationItem
          href="/docs/issue-funding/promote"
          icon={<ArrowForward fontSize="inherit" />}
        >
          Promote
        </NavigationItem>
        <NavigationItem
          href="/docs/issue-funding/reward-contributors"
          icon={<ArrowForward fontSize="inherit" />}
        >
          Reward Contributors
        </NavigationItem>
      </NavigationSection>
    </>
  )
}

const FAQSections = () => {
  return (
    <NavigationSection title="FAQ" defaultOpened={true}>
      <div className="flex flex-col">
        <NavigationItem
          href="/docs/faq/overview"
          icon={<ArrowForward fontSize="inherit" />}
        >
          Overview
        </NavigationItem>
        <NavigationItem
          href="/docs/faq/for-maintainers"
          icon={<ArrowForward fontSize="inherit" />}
        >
          For Maintainers
        </NavigationItem>
        <NavigationItem
          href="/docs/faq/for-backers"
          icon={<ArrowForward fontSize="inherit" />}
        >
          For Backers
        </NavigationItem>
        <NavigationItem
          href="/docs/faq/for-contributors"
          icon={<ArrowForward fontSize="inherit" />}
        >
          For Contributors
        </NavigationItem>
      </div>
    </NavigationSection>
  )
}

const APISections = () => {
  return (
    <div className="flex flex-col">
      <NavigationItem href="/docs/api">Introduction</NavigationItem>
      <NavigationItem href="/docs/api/authentication">
        Authentication
      </NavigationItem>
      <NavigationItem href="/docs/api/polar-sdk">Polar SDK</NavigationItem>
      <NavigationItem href="/docs/api/github-actions">
        GitHub Actions
      </NavigationItem>
    </div>
  )
}

const WebhooksReferenceSections = () => {
  return (
    <div className="flex flex-col gap-y-6">
      <h3>Webhooks</h3>
      <div className="flex flex-col">
        <NavigationItem href="/docs/api/webhooks">Overview</NavigationItem>
        <NavigationItem href="/docs/api/webhooks/events">Events</NavigationItem>
      </div>
    </div>
  )
}

const APIMethodPill = ({ method }: { method: HttpMethod }) => {
  const mc = method.toUpperCase()
  return (
    <span
      className={twMerge(
        'dark:bg-polar-800 rounded-sm bg-gray-200/50 px-1.5 py-0 font-mono text-[10px] font-normal',
        mc === HttpMethod.GET &&
          'bg-green-100 text-green-500 dark:bg-green-950/50',
        mc === HttpMethod.POST &&
          'bg-blue-100 text-blue-500 dark:bg-blue-950/50',
        mc === HttpMethod.DELETE &&
          'bg-red-100 text-red-500 dark:bg-red-950/50',
        (mc === HttpMethod.PATCH || mc === HttpMethod.PUT) &&
          'bg-orange-100 text-orange-500 dark:bg-orange-950/50',
      )}
    >
      {mc}
    </span>
  )
}

const APIReferenceSections = ({
  openAPISchema,
  filter,
  title,
  activeOperationId,
}: {
  openAPISchema: OpenAPIV3_1.Document
  filter: (endpoint: OpenAPIV3_1.PathItemObject) => boolean
  title: string
  activeOperationId: string | undefined
}) => {
  const sections = getAPISections(openAPISchema, filter)
  const isOpenedSection = (section: APISection) =>
    section.endpoints.some((endpoint) => endpoint.id === activeOperationId)

  return (
    <div className="flex flex-col gap-y-6">
      <h3>{title}</h3>
      <div className="flex flex-col gap-y-5">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.name}
            title={section.name}
            defaultOpened={isOpenedSection(section)}
            isSubMenu={true}
          >
            {section.endpoints.map((endpoint) => (
              <NavigationItem
                key={endpoint.id}
                className="m-0 bg-transparent p-0 text-sm dark:bg-transparent"
                href={`/docs/api${endpoint.path}${endpoint.path.endsWith('/') ? '' : '/'}${endpoint.method}`}
                active={() => endpoint.id === activeOperationId}
              >
                <div className="flex w-full flex-row items-center justify-between gap-x-4">
                  {endpoint.name}
                  <APIMethodPill method={endpoint.method} />
                </div>
              </NavigationItem>
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
  defaultOpened,
  isSubMenu = true,
}: PropsWithChildren<{
  title: string
  defaultOpened?: boolean
  isSubMenu: boolean
}>) => {
  const [isOpen, setIsOpen] = useState(defaultOpened || false)

  let containerClasses = ''
  if (isSubMenu) {
    containerClasses = twMerge(
      '-mx-4 -my-2 flex flex-col gap-y-2  px-4 py-2 hover:bg-gray-75 group rounded-xl transition-colors duration-100 dark:border dark:border-transparent',
      isOpen
        ? 'bg-gray-75 dark:border-polar-700 dark:bg-transparent'
        : 'dark:hover:bg-polar-800',
    )
  }

  return (
    <div className={containerClasses}>
      <div
        className="flex cursor-pointer flex-row items-center justify-between"
        onClick={() => setIsOpen((open) => !open)}
      >
        <h2
          className={twMerge(
            isSubMenu &&
              'dark:text-polar-500 dark:group-hover:text-polar-50 text-sm capitalize text-gray-500 transition-colors group-hover:text-black',
            isOpen && 'text-black dark:text-white',
          )}
        >
          {title}
        </h2>
        <span className="dark:text-polar-500 text-gray-500">
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

export const MainNavigation = () => {
  return (
    <>
      <OverviewSections />
      <FAQSections />
    </>
  )
}

export const APINavigation = ({
  openAPISchema,
  activeOperationId,
}: {
  openAPISchema: OpenAPIV3_1.Document
  activeOperationId: string | undefined
}) => {
  return (
    <>
      <APISections />
      <WebhooksReferenceSections />
      <APIReferenceSections
        openAPISchema={openAPISchema}
        filter={isFeaturedEndpoint}
        title="Featured Endpoints"
        activeOperationId={activeOperationId}
      />
      <APIReferenceSections
        openAPISchema={openAPISchema}
        filter={isNotFeaturedEndpoint}
        title="Other Endpoints"
        activeOperationId={activeOperationId}
      />
    </>
  )
}

export const DocumentationPageSidebar = ({
  children,
  activeSection,
}: {
  children?: React.ReactNode
  activeSection: 'overview' | 'api' | 'guides' | 'support' | 'contribute'
}) => {
  const { isShown, show, hide, toggle } = useModal()

  return (
    <div className="flex w-full flex-shrink-0 flex-col gap-y-12 md:w-60">
      <div className="-mx-3 hidden flex-col gap-y-12 md:flex">
        <CommandPaletteTrigger className="w-full" onClick={show} />
      </div>
      <ul className="flex flex-col">
        <li>
          <NavigationItem
            icon={<SpaceDashboardOutlined fontSize="inherit" />}
            href="/docs"
            active={() => activeSection === 'overview'}
          >
            Product Guides
          </NavigationItem>
        </li>
        <li>
          <NavigationItem
            icon={<ApiOutlined fontSize="inherit" />}
            href="/docs/api"
            active={() => activeSection === 'api'}
          >
            API Reference
          </NavigationItem>
        </li>
        <li className="hidden">
          <NavigationItem
            icon={<DescriptionOutlined fontSize="inherit" />}
            href="/docs/guides"
            active={() => activeSection === 'guides'}
          >
            Guides
          </NavigationItem>
        </li>
        <li>
          <NavigationItem
            icon={<FavoriteBorderOutlined fontSize="inherit" />}
            href="/docs/contribute"
            active={() => activeSection === 'contribute'}
          >
            Contribute (Open Source)
          </NavigationItem>
        </li>
        <li>
          <NavigationItem
            icon={<SupportOutlined fontSize="inherit" />}
            href="/docs/support"
            active={() => activeSection === 'support'}
          >
            Support
          </NavigationItem>
        </li>
      </ul>

      {children && (
        <>
          <Separator />
          <div className="flex flex-col gap-y-8">{children}</div>
        </>
      )}

      <SearchPalette isShown={isShown} toggle={toggle} hide={hide} />
    </div>
  )
}

export const MobileNav = ({
  children,
  activeSection,
}: {
  children: React.ReactNode
  activeSection: 'overview' | 'api' | 'guides' | 'support' | 'contribute'
}) => {
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
      <div className="dark:bg-polar-900 relative flex flex-row items-center justify-between bg-white">
        {header}
      </div>
      <div className="z-10 flex h-full flex-col pt-8">
        <DocumentationPageSidebar activeSection={activeSection}>
          {children}
        </DocumentationPageSidebar>
      </div>
    </div>
  ) : (
    header
  )
}
