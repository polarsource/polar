import {
  DiscountOutlined,
  FavoriteBorderOutlined,
  SyncAlt,
} from '@mui/icons-material'
import { Pill } from 'polarkit/components/ui/atoms'
import { PropsWithChildren } from 'react'
import { Section } from './Section'

const PriceItem = ({
  title,
  description,
  icon,
  link,
}: {
  title: string
  description: string
  icon: JSX.Element
  link?: string
}) => {
  const Wrapper = ({
    children,
    className,
  }: PropsWithChildren<{ className: string }>) => {
    return link ? (
      <>
        <a href={link} target="_blank" rel="noreferrer" className={className}>
          {children}
        </a>
      </>
    ) : (
      <p className={className}>{children}</p>
    )
  }

  return (
    <div className="p-10 md:w-1/2">
      <div className="flex h-full flex-col items-center gap-y-6 text-center">
        <div className="flex flex-col text-blue-500">{icon}</div>
        <div className="flex h-full flex-col gap-y-2">
          <h3 className="text-lg leading-snug">{title}</h3>
          <Wrapper className="dark:text-polar-500 text-md h-full text-balance text-gray-500 group-hover:text-black dark:group-hover:text-white">
            {description}
          </Wrapper>
        </div>
      </div>
    </div>
  )
}

export const Pricing = () => {
  return (
    <Section id="pricing" className="items-center gap-y-16">
      <div className="flex flex-col items-center gap-y-12">
        <Pill className="px-4 py-2 text-sm font-normal" color="gray">
          Early Member Pricing
        </Pill>
        <div className="flex flex-col items-center gap-y-4">
          <h1 className="text-center text-3xl md:text-5xl">4% + 40¢</h1>
          <p className="dark:text-polar-500 text-center text-xl text-gray-500">
            Transparent pricing aligned with your success
          </p>
        </div>
      </div>
      <div className="rounded-4xl flex w-full flex-col items-center divide-y overflow-hidden md:flex-row md:divide-x md:divide-y-0">
        <PriceItem
          icon={<FavoriteBorderOutlined fontSize="large" />}
          title="Zero Fixed Costs"
          description="No hidden or monthly costs"
          link="/docs/fees"
        />
        <PriceItem
          icon={<DiscountOutlined fontSize="large" />}
          title="Volume Pricing"
          description="Large or fast-growing business? Reach out to us."
          link="/docs/fees"
        />
        <PriceItem
          icon={<SyncAlt fontSize="large" />}
          title="Additional Stripe Fees"
          description="International, billing & payout fees may apply"
          link="/docs/fees"
        />
      </div>
    </Section>
  )
}
