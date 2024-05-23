'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { CommandPaletteTrigger } from '@/components/CommandPalette/CommandPaletteTrigger'
import { useModal } from '@/components/Modal/useModal'
import {
  ApiOutlined,
  CloseOutlined,
  DescriptionOutlined,
  ShortTextOutlined,
  SpaceDashboardOutlined,
} from '@mui/icons-material'
import { usePathname } from 'next/navigation'
import { Separator } from 'polarkit/components/ui/separator'
import { useEffect, useState } from 'react'
import { sections } from './APINavigation'
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
        <Separator />
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
    <div className="dark:bg-polar-900 fixed left-0 right-0 top-0 z-50 flex flex-row items-center justify-between bg-white p-4 md:hidden">
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
    <div className="flex h-full flex-col">
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
      </div>

      <div className="flex flex-col gap-y-4">
        <h2 className="font-medium">Issue Funding</h2>
        <div className="flex flex-col">
          <NaviagtionItem href="/docs/overview/issue-funding/overview">
            Overview
          </NaviagtionItem>
          <NaviagtionItem href="/docs/overview/issue-funding/getting-started">
            Getting Started
          </NaviagtionItem>
          <NaviagtionItem href="/docs/overview/issue-funding/workflow">
            Workflow
          </NaviagtionItem>
          <NaviagtionItem href="/docs/overview/issue-funding/promote">
            Promote
          </NaviagtionItem>
          <NaviagtionItem href="/docs/overview/issue-funding/reward-contributors">
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
        <NaviagtionItem href="/docs/overview/faq/overview">
          Overview
        </NaviagtionItem>
        <NaviagtionItem href="/docs/overview/faq/for-maintainers">
          For Maintainers
        </NaviagtionItem>
        <NaviagtionItem href="/docs/overview/faq/for-backers">
          For Backers
        </NaviagtionItem>
        <NaviagtionItem href="/docs/overview/faq/for-contributors">
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
      <NaviagtionItem href="/docs/api-reference/github-actions">
        GitHub Actions
      </NaviagtionItem>
    </div>
  )
}

const APIReferenceSections = () => {
  return (
    <>
      {sections.map((section) => (
        <div key={section.name} className="flex flex-col gap-y-4">
          <h2 className="font-medium capitalize">{section.name}</h2>
          <div className="flex flex-col">
            {section.endpoints.map((endpoint) => (
              <NaviagtionItem
                key={endpoint.path + endpoint.method}
                className="text-sm"
                href={`/docs/api-reference/${endpoint.path}/${endpoint.method}`}
                active={(pathname) =>
                  pathname.includes(`${endpoint.path}/${endpoint.method}`)
                }
              >
                <div className="flex w-full flex-row items-center justify-between gap-x-4">
                  {endpoint.name}
                  <span className="dark:bg-polar-800 rounded-sm bg-gray-200/50 px-1.5 py-0 font-mono text-[10px] font-normal uppercase">
                    {endpoint.method}
                  </span>
                </div>
              </NaviagtionItem>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
