import { ArrowForward } from '@mui/icons-material'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { PropsWithChildren, useState } from 'react'
import { Section } from './Section'

const codeExample = `curl -X POST \

https://api.polar.sh/api/v1/issues/123/add_badge \

-H "Content-type: application/json" \
-H "Accept: application/json" \
-H "Authorization: Bearer <token>" \
`

const items = [
  {
    title: 'From Idea to Funding',
    description:
      'We offer a wide array of monetization tools for your project, from one-time payments & recurring subscriptions to donations. We handle all the complexity of payments, so you can focus on building your project.',
  },
  {
    title: 'Build a Community from Day 1',
    description:
      'Polar offers a seamless service to enable your community to pool funding towards issues - helping support, upvote and fund the most impactful efforts. You can also easily reward contributors a share of the funding once the issue is completed.',
  },
  {
    title: 'Turn your passion into a Business',
    description:
      'Take your project to the next level by operating your project as a business. With Products, you can sell licenses, access to private repositories, or any other digital product you can think of.',
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
    title: 'Built entirely Open Source',
    description:
      'We believe in transparency and trust, so we open sourced our entire platform. You can find our code on GitHub.',
  },
]

export const Journey = () => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  return (
    <Section className="gap-y-24">
      <h3 className="text-4xl leading-relaxed">
        Focus on your passion —<br />
        while we build infrastructure to get you paid
      </h3>
      <div className="flex flex-row gap-x-24">
        <div className="flex w-1/2 flex-col">
          <List>
            {items.map((item, index) => (
              <FeatureItem
                key={item.title}
                title={item.title}
                description={item.description}
                active={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </List>
        </div>
        <div className="flex w-1/2 flex-col items-center justify-center">
          <div className="flex flex-col rounded-3xl border p-8 font-mono">
            <pre className="select-text overflow-auto text-wrap p-4 font-mono text-xs leading-loose text-gray-900 dark:text-white">
              {codeExample}
            </pre>
          </div>
        </div>
      </div>
    </Section>
  )
}

const FeatureItem = ({
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
      className="hover:bg-gray-75 dark:hover:bg-polar-900 flex flex-col items-start gap-y-4 p-6 dark:bg-transparent"
      selected={active}
      onSelect={onClick}
    >
      <div className="flex flex-row items-center gap-x-4">
        <ArrowForward className="text-black dark:text-white" fontSize="small" />
        <h3 className="text-lg">{title}</h3>
      </div>
      {active && (
        <div className="dark:text-polar-200 flex flex-col text-sm leading-relaxed text-gray-500">
          {description}
        </div>
      )}
    </ListItem>
  )
}
