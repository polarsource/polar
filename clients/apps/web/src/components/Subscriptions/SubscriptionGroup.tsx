import { Add } from '@mui/icons-material'
import { SubscriptionGroup } from '@polar-sh/sdk'
import { Button } from 'polarkit/components/ui/button'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'
import SubscriptionTierCard from './SubscriptionTierCard'

interface SubscriptionGroupProps {
  subscriptionGroup: SubscriptionGroup
}

const SubscriptionGroup: React.FC<SubscriptionGroupProps> = ({
  subscriptionGroup,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">
            <SubscriptionGroupIcon
              icon={subscriptionGroup.icon}
              color={subscriptionGroup.color}
            />
            <span className="ml-2">{subscriptionGroup.name}</span>
          </h2>
          <Button variant="outline" size="sm">
            <Add className="mr-1" />
            New Tier
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          {subscriptionGroup.description}
        </p>
      </div>
      <div className="grid auto-cols-[300px] grid-flow-col gap-4 overflow-x-auto">
        {subscriptionGroup.tiers.map((tier) => (
          <SubscriptionTierCard
            key={tier.id}
            subscriptionGroup={subscriptionGroup}
            subscriptionTier={tier}
          />
        ))}
      </div>
    </div>
  )
}

export default SubscriptionGroup
