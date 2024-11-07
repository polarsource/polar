import useDebouncedCallback from '@/hooks/utils'
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
      className="dark:hover:bg-polar-600 group flex flex-col gap-y-1 rounded-xl px-3 py-2 transition-colors hover:bg-gray-100"
      href={link}
    >
      <span className="flex flex-row items-center gap-x-2">
        <h3 className="text-sm">{title}</h3>
      </span>
      <span className="dark:text-polar-500 text-sm text-gray-500 transition-colors group-hover:text-black dark:group-hover:text-white">
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
        className="dark:hover:bg-polar-700 dark:data-[state=open]:bg-polar-700 rounded-full px-4 py-2 focus-within:outline-0 hover:bg-gray-100 data-[state=open]:bg-gray-100"
        onMouseEnter={() => {
          togglePopover(true)
        }}
        onMouseLeave={() => {
          togglePopover(false)
        }}
      >
        Platform
        <PopoverContent
          className="rounded-4xl shadow-3xl flex w-[920px] flex-row divide-x p-8 dark:text-white"
          sideOffset={20}
        >
          <div className="flex w-1/2 flex-col gap-y-4 pr-8">
            <h3 className="ml-3 text-lg">Features</h3>
            <div className="flex flex-col gap-y-2">
              <PopoverLinkItem
                title="Products & Subscriptions"
                description="Offer digital products or subscriptions"
                link="/docs/products"
              />
              <PopoverLinkItem
                title="Issue Funding & Rewards"
                description="Crowdfunding for GitHub issues with contributor rewards"
                link="/docs/issue-funding"
              />
              <PopoverLinkItem
                title="Donations"
                description="Get ad-hoc support from your community"
                link="/docs/donations"
              />
            </div>
          </div>
          <div className="flex w-1/2 flex-col gap-y-4 pl-8">
            <h3 className="ml-3 text-lg">Offer Built-in Benefits</h3>
            <div className="flex flex-col gap-y-2">
              <PopoverLinkItem
                title="License Keys"
                description="Sell access to your custom software with License Keys"
                link="/docs/benefits/license-keys"
              />
              <PopoverLinkItem
                title="Private GitHub Repositories"
                description="Grant access to private repositories"
                link="/docs/benefits/github-repositories"
              />
              <PopoverLinkItem
                title="Discord Server Access"
                description="Automatic Discord role assignment"
                link="/docs/benefits/discord"
              />
              <PopoverLinkItem
                title="File Downloads"
                description="Access to exclusive file downloads"
                link="/docs/benefits/file-downloads"
              />
              <PopoverLinkItem
                title="Custom"
                description="Offer custom benefits for your special usecase"
                link="/docs/benefits#create-a-custom-benefit"
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
        className="dark:hover:bg-polar-700 dark:data-[state=open]:bg-polar-700 rounded-full px-4 py-2 focus-within:outline-0 hover:bg-gray-100 data-[state=open]:bg-gray-100"
        onMouseEnter={() => {
          togglePopover(true)
        }}
        onMouseLeave={() => {
          togglePopover(false)
        }}
      >
        Docs
        <PopoverContent
          className="rounded-4xl shadow-3xl flex w-[920px] flex-row divide-x p-8 dark:text-white"
          sideOffset={20}
        >
          <div className="flex w-1/2 flex-col gap-y-4 pr-8">
            <h3 className="ml-3 text-lg">Documentation</h3>
            <div className="flex flex-col gap-y-2">
              <PopoverLinkItem
                title="Getting Started"
                description="How-to setup an account and start monetizing"
                link="/docs"
              />
              <PopoverLinkItem
                title="Guides"
                description="How-to guides for common use-cases"
                link="/docs/guides"
              />
              <PopoverLinkItem
                title="Support"
                description="Get help from the Polar team"
                link="/docs/support"
              />
              <PopoverLinkItem
                title="FAQ"
                description="Common support questions"
                link="/docs/support/faq"
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
                description="Streamline authentication and unlocking user benefits"
                link="/docs/api/authentication"
              />
              <PopoverLinkItem
                title="Webhooks"
                description="Integrate Polar with your application"
                link="/docs/api/webhooks"
              />
              <PopoverLinkItem
                title="Polar SDKs"
                description="Build with our JavaScript & Python SDKs"
                link="/docs/api/sdk"
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
    <div className="absolute left-1/2 hidden -translate-x-1/2 flex-row items-center text-sm md:flex">
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
