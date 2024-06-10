import {
  AllInclusiveOutlined,
  ArrowForward,
  AttachMoneyOutlined,
  FavoriteBorderOutlined,
  HowToVoteOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { PropsWithChildren, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Section } from './Section'
interface FeatureItemProps {
  icon: JSX.Element
  title: string
  description: string
  link: string
}

const FeatureItem = ({ title, icon, description, link }: FeatureItemProps) => {
  return (
    <Link className="group flex h-full flex-col" href={link}>
      <Card className="hover:bg-gray-75 dark:hover:bg-polar-900 flex h-full flex-col transition-colors">
        <CardHeader className="flex flex-row items-center gap-x-4 space-y-0 pb-4">
          <span className="dark:bg-polar-800 dark flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-gray-200 transition-colors group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black">
            {icon}
          </span>
          <h3 className="text-lg leading-snug">{title}</h3>
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-y-4 pb-6">
          <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500 group-hover:text-black dark:group-hover:text-white">
            {description}
          </p>
        </CardContent>
        <CardFooter className="dark:text-polar-200 flex flex-row items-center gap-x-2 text-sm text-gray-500 group-hover:text-black dark:group-hover:text-white">
          <span className="text-sm">Learn More</span>
          <ArrowForward fontSize="inherit" />
        </CardFooter>
      </Card>
    </Link>
  )
}

const items = [
  {
    title: 'From Idea to Funding',
    description:
      'We offer a wide array of monetization tools for your project, from one-time payments & recurring subscriptions to donations.',
    content: (
      <div className="flex flex-col gap-y-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FeatureItem
            icon={<HowToVoteOutlined fontSize="small" />}
            title="Issue Funding"
            description="Polar allows you to fund issues in your repository. You can create a badge for a GitHub issue and allow your community to fund it."
            link="/docs/overview/issue-funding/overview"
          />
          <FeatureItem
            icon={<FavoriteBorderOutlined fontSize="small" />}
            title="Rewards"
            description="Setup & promote an upfront reward to potential contributors, on your GitHub issues."
            link="/docs/overview/issue-funding/reward-contributors"
          />
          <FeatureItem
            icon={<AttachMoneyOutlined fontSize="small" />}
            title="Donations"
            description="Makes it a piece of cake for your supporters to donate."
            link="/docs/overview/donations"
          />
          <FeatureItem
            icon={<AllInclusiveOutlined fontSize="small" />}
            title="Subscriptions"
            description="Offer paid subscription tiers, with associated benefits that you give in return."
            link="/docs/overview/subscriptions"
          />
        </div>
      </div>
    ),
  },
  {
    title: 'Turn your passion into a Business',
    description:
      'Take your project to the next level with Products. Sell licenses, access to private repositories, or any other digital product you can think of.',
  },
  {
    title: 'We handle your taxes',
    description: `We're the merchant of record, handling boilerplate (billing, receipts, customer accounts etc) & your headaches (sales tax, VAT).`,
  },
  {
    title: 'Deeply integrated with GitHub',
    description: `Polar is built on top of GitHub, so you can easily integrate with your existing workflow. We're also proud to be an official GitHub funding option.`,
  },
  {
    title: 'Developer Experience in the front seat',
    description:
      'We believe in transparency and trust, so we open sourced our entire platform. You can find our code on GitHub.',
  },
]

export const Journey = () => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  return (
    <Section className="gap-y-16">
      <h3 className="text-4xl leading-relaxed">
        Focus on your passion —<br />
        while we build infrastructure to get you paid
      </h3>
      <div className="flex flex-row gap-x-16">
        <div className="flex w-1/3 flex-col">
          <List>
            {items.map((item, index) => (
              <JourneyItem
                key={item.title}
                title={item.title}
                description={item.description}
                active={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </List>
        </div>
        <div className="flex w-2/3 flex-col">
          {items[selectedIndex].content}
        </div>
      </div>
    </Section>
  )
}

const JourneyItem = ({
  title,
  description,
  children,
  active,
  onClick,
}: PropsWithChildren<{
  title: string
  description: string
  active: boolean
  onClick: () => void
}>) => {
  return (
    <ListItem
      className={twMerge(
        'hover:bg-gray-75 dark:hover:bg-polar-900 flex flex-col items-start gap-y-4 p-6',
        active && 'dark:bg-polar-900',
      )}
      selected={active}
      onSelect={onClick}
    >
      <div className="flex flex-row gap-x-6">
        <ArrowForward className="text-black dark:text-white" fontSize="small" />
        <div className="-mt-1 flex flex-col gap-y-2">
          <h3 className="text-lg">{title}</h3>
          {active && (
            <div className="dark:text-polar-200 flex flex-col text-sm leading-relaxed text-gray-500">
              {description}
            </div>
          )}
        </div>
      </div>
    </ListItem>
  )
}
