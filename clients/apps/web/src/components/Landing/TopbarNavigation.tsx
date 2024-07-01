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
        className="dark:hover:bg-polar-800 dark:data-[state=open]:bg-polar-800 rounded-full px-4 py-2 focus-within:outline-0 hover:bg-gray-100 data-[state=open]:bg-gray-100"
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
                title="Products & Subscriptions"
                description="One-time & recurring funding in exchange for benefits"
                link="/products"
              />
              <PopoverLinkItem
                title="Donations"
                description="A tip jar for your projects"
                link="/donations"
              />
              <PopoverLinkItem
                title="Newsletters"
                description="Reach your community with insightful posts"
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
                link="/benefits"
              />
              <PopoverLinkItem
                title="Private GitHub Repositories"
                description="Grant access to private repositories"
                link="/benefits"
              />
              <PopoverLinkItem
                title="Discord Server Access"
                description="Automatic Discord role assignment"
                link="/benefits"
              />
              <PopoverLinkItem
                title="File Downloads"
                description="Access to exclusive file downloads"
                link="/benefits"
              />
              <PopoverLinkItem
                title="Advertisements"
                description="Promote your supporters in READMEs & Newsletters"
                link="/benefits"
              />
              <PopoverLinkItem
                title="Premium Newsletters"
                description="Early & private access to newsletters"
                link="/benefits"
              />
              <PopoverLinkItem
                title="Custom"
                description="Offer custom benefits for your special usecase"
                link="/benefits"
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
        className="dark:hover:bg-polar-800 dark:data-[state=open]:bg-polar-800 rounded-full px-4 py-2 focus-within:outline-0 hover:bg-gray-100 data-[state=open]:bg-gray-100"
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
                link="/docs/api"
              />
              <PopoverLinkItem
                title="OAuth"
                description="Authentication with the Polar API"
                link="/docs/api/authentication"
              />
              <PopoverLinkItem
                title="Webhooks"
                description="Integrate Polar with your application"
                link="/docs/api/webhooks"
              />
              <PopoverLinkItem
                title="Polar SDK"
                description="Our very own TypeScript SDK"
                link="/docs/api/polar-sdk"
              />
              <PopoverLinkItem
                title="GitHub Actions"
                description="Use Polar in your CI/CD pipeline"
                link="/docs/api/github-actions"
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
    <div className="absolute left-1/2 hidden -translate-x-1/2 flex-row items-center gap-x-4 text-sm md:flex">
      <PlatformPopover />
      <DocumentationPopover />
      <Link
        className="dark:hover:bg-polar-800 rounded-full px-4 py-2 hover:bg-gray-100"
        href="/#pricing"
      >
        Pricing
      </Link>
    </div>
  )
}
