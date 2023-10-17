import { SubscriptionGroup, SubscriptionTier } from '@polar-sh/sdk'
import { Card, CardHeader } from 'polarkit/components/ui/card'
import { Separator } from 'polarkit/components/ui/separator'
import { getCentsInDollarString } from 'polarkit/money'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'

interface SubscriptionTierCardProps {
  subscriptionGroup: SubscriptionGroup
  subscriptionTier: SubscriptionTier
}

const hexToRGBA = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
        result[3],
        16,
      )}, ${opacity})`
    : ''
}

const SubscriptionTierCard: React.FC<SubscriptionTierCardProps> = ({
  subscriptionTier,
  subscriptionGroup,
}) => {
  const style = {
    '--var-bg-color': hexToRGBA(subscriptionGroup.color, 0.1),
    '--var-muted-color': hexToRGBA(subscriptionGroup.color, 0.5),
    '--var-fg-color': subscriptionGroup.color,
  } as React.CSSProperties

  return (
    <Card
      className="border-0 bg-[--var-bg-color] bg-gradient-to-tr shadow-none"
      style={style}
    >
      <CardHeader>
        <div className="flex justify-between">
          <h3 className="font-medium">{subscriptionTier.name}</h3>
          <SubscriptionGroupIcon
            icon={subscriptionGroup.icon}
            color={subscriptionGroup.color}
          />
        </div>
        <div className="flex flex-col gap-4 text-[--var-fg-color]">
          <div className="text-4xl">
            $
            {getCentsInDollarString(subscriptionTier.price_amount, false, true)}
            <span className="text-lg text-[--var-muted-color]"> / mo</span>
          </div>
          <Separator className="bg-[--var-muted-color]" />
          <p className="text-sm">{subscriptionTier.description}</p>
        </div>
      </CardHeader>
    </Card>
  )
}

export default SubscriptionTierCard
