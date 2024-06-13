import useDebouncedCallback from '@/hooks/utils'
import { ArrowForward } from '@mui/icons-material'
import Link from 'next/link'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'polarkit/components/ui/popover'
import { useState } from 'react'

const PopoverLinkItem = ({
  title,
  description,
  link,
}: {
  title: string
  description: string
  link: string
}) => {
  return (
    <Link
      className="dark:hover:bg-polar-800 group flex flex-col gap-y-1 rounded-xl px-3 py-2 hover:bg-gray-100"
      href={link}
    >
      <span className="flex flex-row items-center gap-x-2">
        <ArrowForward fontSize="inherit" />
        <h3 className="text-sm">{title}</h3>
      </span>
      <span className="dark:text-polar-500 text-sm text-gray-500 group-hover:text-black dark:group-hover:text-white">
        {description}
      </span>
    </Link>
  )
}

const PlatformPopover = () => {
  const [isOpen, setIsOpen] = useState(false)

  const togglePopover = useDebouncedCallback((toggle: boolean) => {
    setIsOpen(toggle)
  }, 100)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className="dark:hover:bg-polar-800 data-[state=open]:bg-polar-800 rounded-full px-4 py-2 focus-within:outline-0"
        onMouseEnter={() => {
          togglePopover(true)
        }}
        onMouseLeave={() => {
          togglePopover(false)
        }}
      >
        Platform
        <PopoverContent
          className="flex w-[920px] flex-row divide-x rounded-3xl p-6 dark:text-white"
          sideOffset={20}
        >
          <div className="flex w-1/2 flex-col gap-y-4 pr-8">
            <h3 className="ml-3 text-lg">Features</h3>
            <div className="flex flex-col gap-y-2">
              <PopoverLinkItem
                title="Issue Funding & Rewards"
                description="Crowdfunded GitHub issues on steroids"
                link="/issue-funding"
              />
              <PopoverLinkItem
                title="Donations"
                description="A tip jar for your projects"
                link="/donations"
              />
              <PopoverLinkItem
                title="Subscriptions"
                description="Recurring funding in exchange for benefits"
                link="/subscriptions"
              />
              <PopoverLinkItem
                title="Products"
                description="Sell digital products & services"
                link="/products"
              />
              <PopoverLinkItem
                title="Newsletters"
                description="Reach your community with insightful posts"
                link="/newsletters"
              />
              <PopoverLinkItem
                title="Public Page"
                description="A home for your profile on Polar"
                link="/newsletters"
              />
            </div>
          </div>
          <div className="flex w-1/2 flex-col gap-y-4 pl-8">
            <h3 className="ml-3 text-lg">Benefits</h3>
            <div className="flex flex-col gap-y-2">
              <PopoverLinkItem
                title="Introducing Benefits"
                description="Offer exclusive benefits to your supporters"
                link="#"
              />
              <PopoverLinkItem
                title="Private GitHub Repositories"
                description="Grant access to private repositories"
                link="#"
              />
              <PopoverLinkItem
                title="Discord Server Access"
                description="Automatic Discord role assignment"
                link="#"
              />
              <PopoverLinkItem
                title="File Downloads"
                description="Access to exclusive file downloads"
                link="#"
              />
              <PopoverLinkItem
                title="Advertisements"
                description="Promote your supporters in READMEs & Newsletters"
                link="#"
              />
              <PopoverLinkItem
                title="Premium Newsletters"
                description="Early & private access to newsletters"
                link="#"
              />
              <PopoverLinkItem
                title="Custom"
                description="Offer custom benefits for your special usecase"
                link="#"
              />
            </div>
          </div>
        </PopoverContent>
      </PopoverTrigger>
    </Popover>
  )
}

const DocumentationPopover = () => {
  const [isOpen, setIsOpen] = useState(false)

  const togglePopover = useDebouncedCallback((toggle: boolean) => {
    setIsOpen(toggle)
  }, 100)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className="dark:hover:bg-polar-800 data-[state=open]:bg-polar-800 rounded-full px-4 py-2 focus-within:outline-0"
        onMouseEnter={() => {
          togglePopover(true)
        }}
        onMouseLeave={() => {
          togglePopover(false)
        }}
      >
        Documentation
        <PopoverContent
          className="flex w-[920px] flex-row divide-x rounded-3xl p-6 dark:text-white"
          sideOffset={20}
        >
          <div className="flex w-1/2 flex-col gap-y-4 pr-8">
            <h3 className="ml-3 text-lg">Documentation</h3>
            <div className="flex flex-col gap-y-2">
              <PopoverLinkItem
                title="Getting Started"
                description="Start your journey with Polar"
                link="/docs/overview"
              />
              <PopoverLinkItem
                title="Guides"
                description="Learn how to use Polar"
                link="/docs/guides"
              />
              <PopoverLinkItem
                title="FAQ"
                description="Frequently Asked Questions"
                link="/docs/overview/faq/for-maintainers"
              />
              <PopoverLinkItem
                title="Support"
                description="Get help from the Polar team"
                link="/docs/overview/support"
              />
            </div>
          </div>
          <div className="flex w-1/2 flex-col gap-y-4 pl-8">
            <h3 className="ml-3 text-lg">API</h3>
            <div className="flex flex-col gap-y-2">
              <PopoverLinkItem
                title="API Reference"
                description="Integrate Polar with your application"
                link="/docs/api-reference/introduction"
              />
              <PopoverLinkItem
                title="Polar SDK"
                description="Our very own TypeScript SDK"
                link="/docs/api-reference/polar-sdk"
              />
              <PopoverLinkItem
                title="GitHub Actions"
                description="Use Polar in your CI/CD pipeline"
                link="/docs/api-reference/github-actions"
              />
              <PopoverLinkItem
                title="OAuth"
                description="Authentication with the Polar API"
                link="/docs/api-reference/github-actions"
              />
            </div>
          </div>
        </PopoverContent>
      </PopoverTrigger>
    </Popover>
  )
}

export const TopbarNavigation = () => {
  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 flex-row items-center gap-x-4 text-sm">
      <PlatformPopover />
      <DocumentationPopover />
      <Link
        className="dark:hover:bg-polar-800 rounded-full px-4 py-2"
        href="https://github.com/polarsource/polar"
        target="_blank"
      >
        Open Source
      </Link>
    </div>
  )
}
