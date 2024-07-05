'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { CommandPaletteTrigger } from '@/components/CommandPalette/CommandPaletteTrigger'
import { useModal } from '@/components/Modal/useModal'
import {
  ArrowForward,
  ArticleOutlined,
  CloseOutlined,
  ConstructionOutlined,
  DescriptionOutlined,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ShortTextOutlined,
  SupportOutlined,
  TerminalOutlined,
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
      <div className="flex flex-col">{children}</div>
    </CollapsibleSection>
  )
}

const NavigationHeadline = ({ children }: { children: React.ReactNode }) => {
  return <h2 className="mb-4 text-sm font-medium text-gray-700">{children}</h2>
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
  return (
    <span
      className={twMerge(
        'dark:bg-polar-800 rounded-sm bg-gray-200/50 px-1.5 py-0 font-mono text-[10px] font-normal',
        method === HttpMethod.GET &&
          'bg-green-100 text-green-500 dark:bg-green-950/50',
        method === HttpMethod.POST &&
          'bg-blue-100 text-blue-500 dark:bg-blue-950/50',
        method === HttpMethod.DELETE &&
          'bg-red-100 text-red-500 dark:bg-red-950/50',
        (method === HttpMethod.PATCH || method === HttpMethod.PUT) &&
          'bg-orange-100 text-orange-500 dark:bg-orange-950/50',
      )}
    >
      {method.toUpperCase()}
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

  let containerClasses =
    '-mx-3 px-3 py-2 text-sm transition-colors hover:text-blue-500 dark:hover:text-white'
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
        <h3
          className={twMerge(
            'dark:text-polar-500 dark:group-hover:text-polar-50 text-sm capitalize text-gray-500 transition-colors group-hover:text-black',
            !isSubMenu && 'hover:text-blue-500 dark:hover:text-white',
            isSubMenu && isOpen && 'text-black dark:text-white',
          )}
        >
          {title}
        </h3>
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
      <div>
        <NavigationHeadline>Introduction</NavigationHeadline>
        <NavigationItem href="/docs">Welcome</NavigationItem>
        <NavigationItem href="/docs/onboarding">Quick Start</NavigationItem>
      </div>

      <div>
        <NavigationHeadline>Get Funding</NavigationHeadline>
        <NavigationItem href="/docs/donations">Donations</NavigationItem>
        <NavigationSection
          title="Issue Funding & Rewards"
          defaultOpened={false}
        >
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
      </div>

      <div>
        <NavigationHeadline>Offer Products & Subscriptions</NavigationHeadline>
        <div className="flex flex-col">
          <NavigationItem href="/docs/subscriptions">
            Create Products & Tiers
          </NavigationItem>
          <NavigationSection title="Offer Benefits" defaultOpened={true}>
            <NavigationItem
              href="/docs/benefits/file-downloads"
              icon={<ArrowForward fontSize="inherit" />}
            >
              File Downloads
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/github-repositories"
              icon={<ArrowForward fontSize="inherit" />}
            >
              GitHub Repo(s) Access
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/discord"
              icon={<ArrowForward fontSize="inherit" />}
            >
              Discord Invites
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/discord"
              icon={<ArrowForward fontSize="inherit" />}
            >
              Premium Newsletter
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/ads"
              icon={<ArrowForward fontSize="inherit" />}
            >
              Newsletter Sponsorship
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/custom"
              icon={<ArrowForward fontSize="inherit" />}
            >
              Custom
            </NavigationItem>
          </NavigationSection>
          <NavigationItem href="/docs/subscriptions">
            Review Sales
          </NavigationItem>
        </div>
      </div>

      <div>
        <NavigationHeadline>Online & Email Newsletters</NavigationHeadline>
        <NavigationItem href="/docs/newsletters">
          Write Posts (GitHub Markdown)
        </NavigationItem>
        <NavigationItem href="/docs/newsletters">
          Publish & Access
        </NavigationItem>
        <NavigationItem href="/docs/newsletters">Review Traffic</NavigationItem>
      </div>

      <div>
        <NavigationHeadline>GitHub Extension</NavigationHeadline>
        <NavigationItem href="/docs/github/install">
          Connect Organization(s)
        </NavigationItem>
        <NavigationItem href="/docs/github/funding-yaml">
          Official FUNDING.yaml link
        </NavigationItem>
        <NavigationItem href="/docs/github/embeds">
          README Embeds
        </NavigationItem>
      </div>

      <div>
        <NavigationHeadline>Finance & Payouts</NavigationHeadline>
        <NavigationItem href="/docs/payments-taxes">
          Your Balance
        </NavigationItem>
        <NavigationItem href="/docs/payments-taxes">
          Connect Payout Account
        </NavigationItem>
        <NavigationItem href="/docs/payments-taxes">Payouts</NavigationItem>
      </div>

      <div>
        <NavigationHeadline>Merchant of Record</NavigationHeadline>
        <NavigationItem href="/docs/merchant-of-record">
          Sales tax & EU VAT
        </NavigationItem>
        <NavigationItem href="/docs/1099k">1099-K Form (US)</NavigationItem>
      </div>
    </>
  )
}

export const SupportNavigation = () => {
  return (
    <div>
      <NavigationHeadline>FAQ</NavigationHeadline>
      <NavigationItem href="/docs/support/faq#pricing">
        Payments & Fees
      </NavigationItem>
      <NavigationItem href="/docs/support/faq#issue-funding">
        Issue funding
      </NavigationItem>
      <NavigationItem href="/docs/support/faq#reward-contributors">
        Reward contributors
      </NavigationItem>
      <NavigationItem href="/docs/support/faq#payouts">Payouts</NavigationItem>
      <NavigationItem href="/docs/support/faq#supported-platforms-countries--currencies">
        Supported Countries & Currencies
      </NavigationItem>
    </div>
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
            icon={<ArticleOutlined fontSize="inherit" />}
            href="/docs"
            active={() => activeSection === 'overview'}
          >
            Documentation
          </NavigationItem>
        </li>
        <li>
          <NavigationItem
            icon={<TerminalOutlined fontSize="inherit" />}
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
            icon={<ConstructionOutlined fontSize="inherit" />}
            href="/docs/contribute"
            active={() => activeSection === 'contribute'}
          >
            Contribute
          </NavigationItem>
        </li>
        <li>
          <NavigationItem
            icon={<SupportOutlined fontSize="inherit" />}
            href="/docs/support"
            active={() => activeSection === 'support'}
          >
            Help
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
