import { DiscountOutlined, FavoriteBorderOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { Pill } from 'polarkit/components/ui/atoms'
import { Section } from './Section'

const PriceItem = ({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: JSX.Element
}) => {
  return (
    <div className="p-8 md:w-1/2">
      <div className="flex h-full flex-col items-center gap-y-6 text-center">
        <div className="flex flex-col text-blue-500">{icon}</div>
        <div className="flex h-full flex-col gap-y-2">
          <h3 className="text-lg leading-snug">{title}</h3>
          <p className="dark:text-polar-500 h-full text-lg leading-relaxed text-gray-500 group-hover:text-black dark:group-hover:text-white">
            {description}
          </p>
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
          Founding Member
        </Pill>
        <div className="flex flex-col items-center gap-y-4">
          <h1 className="text-center text-3xl md:text-5xl">4% + 40¢</h1>
          <p className="dark:text-polar-500 text-center text-xl text-gray-500">
            Fees that don&apos;t leave you squeezed
          </p>
          <p className="dark:text-polar-500 text-center text-sm text-gray-500">
            International, billing and payout fees apply in addition.{' '}
            <Link className="underline" href="/docs/fees" target="_blank">
              See all fees.
            </Link>
          </p>
        </div>
      </div>
      <div className="rounded-4xl flex w-full flex-col items-center divide-y overflow-hidden md:flex-row md:divide-x md:divide-y-0">
        <PriceItem
          icon={<FavoriteBorderOutlined fontSize="large" />}
          title="Zero Fixed Costs"
          description="No hidden or monthly costs"
        />
        <PriceItem
          icon={<DiscountOutlined fontSize="large" />}
          title="Volume Pricing"
          description="Large or fast-growing business? Reach out to us."
        />
      </div>
    </Section>
  )
}
