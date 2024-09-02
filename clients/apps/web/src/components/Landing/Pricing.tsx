import { FavoriteBorderOutlined, SyncAltOutlined } from '@mui/icons-material'
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
    <Section id="pricing" className="gap-y-24">
      <div className="flex flex-col items-center gap-y-4">
        <h1 className="text-center text-3xl md:text-5xl">4% + 40c</h1>
        <p className="dark:text-polar-500 text-center text-xl text-gray-500">
          Transparent pricing aligned with your success
        </p>
      </div>
      <div className="rounded-4xl flex w-full flex-col items-center divide-y overflow-hidden md:flex-row md:divide-x md:divide-y-0">
        <PriceItem
          icon={<FavoriteBorderOutlined fontSize="large" />}
          title="Zero Fixed Costs"
          description="No hidden or monthly costs"
        />
        <PriceItem
          icon={<SyncAltOutlined fontSize="large" />}
          title="Stripe & Open Collective"
          description="Transaction- and payout fees apply"
        />
      </div>
    </Section>
  )
}
