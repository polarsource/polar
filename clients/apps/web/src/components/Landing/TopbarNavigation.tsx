import { ArrowForward } from '@mui/icons-material'
import Link from 'next/link'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'polarkit/components/ui/popover'

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
      <span className="dark:text-polar-200 flex flex-row items-center gap-x-2 text-gray-700 group-hover:text-black dark:group-hover:text-white">
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
  return (
    <Popover>
      <PopoverTrigger className="dark:hover:bg-polar-800 data-[state=open]:bg-polar-800 rounded-full px-4 py-2">
        Platform
        <PopoverContent
          className="flex w-[920px] flex-row divide-x rounded-3xl p-6 dark:text-white"
          sideOffset={20}
        >
          <div className="flex w-1/2 flex-col gap-y-4 pr-8">
            <h3 className="ml-3 text-lg">Features</h3>
            <div className="flex flex-col">
              <PopoverLinkItem
                title="Issue Funding"
                description="Crowdfunded GitHub issues on steroids"
                link="/issue-funding"
              />
              <PopoverLinkItem
                title="Rewards"
                description="Share funding with your contributors"
                link="/rewards"
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
            </div>
          </div>
          <div className="flex w-1/2 flex-col gap-y-4 pl-8">
            <h3 className="ml-3 text-lg">Company</h3>
            <div className="flex flex-col">
              <PopoverLinkItem
                title="Our Mission"
                description="Empowering maintainers to become entrepreneurs"
                link="/our-mission"
              />
              <PopoverLinkItem
                title="Careers"
                description="Come & do your life's best work"
                link="/careers"
              />
              <PopoverLinkItem
                title="Community"
                description="Join our community of entrepreneurs"
                link="/community"
              />
              <PopoverLinkItem
                title="Brand Guidelines"
                description="Get your hands on our brand assets"
                link="/brand"
              />
            </div>
          </div>
        </PopoverContent>
      </PopoverTrigger>
    </Popover>
  )
}

const DocumentationPopover = () => {
  return (
    <Popover>
      <PopoverTrigger className="dark:hover:bg-polar-800 rounded-full px-4 py-2">
        Documentation
      </PopoverTrigger>
      <PopoverContent className="flex w-[920px] flex-row divide-x rounded-3xl p-6 dark:text-white">
        <div className="flex w-1/2 flex-col gap-y-4 pr-8">
          <h3 className="ml-3 text-lg">Documentation</h3>
          <div className="flex flex-col">
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
          <div className="flex flex-col">
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
    </Popover>
  )
}

export const TopbarNavigation = () => {
  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 flex-row items-center gap-x-6 text-sm">
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
