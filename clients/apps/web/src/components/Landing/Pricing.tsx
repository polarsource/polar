import {
  FavoriteBorderOutlined,
  PercentOutlined,
  SyncAltOutlined,
} from '@mui/icons-material'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
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
    <div className="md:w-1/3">
      <Card className="flex h-full flex-col border-none p-2 dark:border-none">
        <CardHeader className="flex flex-col text-blue-500">{icon}</CardHeader>
        <CardContent className="flex h-full flex-col gap-y-2 pb-6">
          <h3 className="text-lg leading-snug">{title}</h3>
          <p className="dark:text-polar-200 h-full text-lg leading-relaxed text-gray-500 group-hover:text-black dark:group-hover:text-white">
            {description}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export const Pricing = () => {
  return (
    <Section id="pricing" className="gap-y-24">
      <div className="flex flex-col items-center gap-y-4">
        <h1 className="text-center text-4xl">Pricing</h1>
        <p className="dark:text-polar-200 text-center text-xl text-gray-500">
          Transparent pricing aligned with your success.
        </p>
      </div>
      <div className="rounded-4xl flex flex-col divide-y overflow-hidden border md:flex-row md:divide-x md:divide-y-0">
        <PriceItem
          icon={<FavoriteBorderOutlined fontSize="large" />}
          title="Zero Fixed Costs"
          description="No hidden or monthly costs."
        />
        <PriceItem
          icon={<PercentOutlined fontSize="large" />}
          title="5% Revenue Share"
          description={`We earn when you do.`}
        />
        <PriceItem
          icon={<SyncAltOutlined fontSize="large" />}
          title="+ Stripe & Open Collective"
          description="Transaction- and payout fees apply."
        />
      </div>
    </Section>
  )
}
