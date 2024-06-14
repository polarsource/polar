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
      <Card className="flex h-full flex-col p-2 dark:border-none">
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
    <Section className="gap-y-24">
      <h1 className="text-center text-4xl">Pricing</h1>
      <div className="flex flex-col divide-y overflow-hidden rounded-3xl border md:flex-row md:divide-x md:divide-y-0">
        <PriceItem
          icon={<FavoriteBorderOutlined fontSize="large" />}
          title="Zero Fixed Costs"
          description="No hidden or monthly costs."
        />
        <PriceItem
          icon={<PercentOutlined fontSize="large" />}
          title="5% Revenue Share"
          description={`We're in this together. We earn when you do.`}
        />
        <PriceItem
          icon={<SyncAltOutlined fontSize="large" />}
          title="Stripe Fees"
          description="Stripe transaction- and payout fees apply before transfers."
        />
      </div>
    </Section>
  )
}
