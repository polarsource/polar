import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { CloseOutlined } from '@mui/icons-material'
import { Product, SubscriptionTierType } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { Checkbox } from 'polarkit/components/ui/checkbox'

export interface SubscriptionTiersModalProps {
  subscriptionTiers: (Product & { type: SubscriptionTierType })[]
  selectedSubscriptionTiers: (Product & { type: SubscriptionTierType })[]
  hideModal: () => void
  setSubscriptionTiers: (
    producer: (
      subscriptionTiers: (Product & { type: SubscriptionTierType })[],
    ) => (Product & { type: SubscriptionTierType })[],
  ) => void
}

export const SubscriptionTiersModal = ({
  subscriptionTiers,
  selectedSubscriptionTiers,
  hideModal,
  setSubscriptionTiers,
}: SubscriptionTiersModalProps) => {
  const addSubscriptionTier = (
    subscriptionTier: Product & { type: SubscriptionTierType },
  ) => {
    setSubscriptionTiers((subscriptionTiers) =>
      [...subscriptionTiers, subscriptionTier].slice(-3),
    )
  }

  const removeSubscriptionTier = (subscriptionTier: Product) => {
    setSubscriptionTiers((subscriptionTiers) =>
      subscriptionTiers.filter((tier) => tier.id !== subscriptionTier.id),
    )
  }

  return (
    <div className="relative flex flex-col gap-y-8 p-10">
      <div className="absolute right-6 top-6">
        <Button
          className="focus-visible:ring-0"
          onClick={hideModal}
          size="icon"
          variant="ghost"
        >
          <CloseOutlined
            className="dark:text-polar-200 text-gray-700"
            fontSize="small"
          />
        </Button>
      </div>
      <div className="flex flex-col gap-y-2">
        <h3>Highlighted Subscription Tiers</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select subscription tiers that you want to highlight on the project
          profile. You can select up to 3 tiers.
        </p>
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[420px] w-full flex-col gap-y-6 overflow-y-auto">
          <div className="flex flex-col gap-y-4">
            <h3>Subscriptions</h3>
            <List className="flex flex-col">
              {subscriptionTiers.map((subscriptionTier) => (
                <ListItem
                  key={subscriptionTier.id}
                  selected={selectedSubscriptionTiers.some(
                    (tier) => tier.id === subscriptionTier.id,
                  )}
                >
                  <SubscriptionTierRow
                    subscriptionTier={subscriptionTier}
                    selected={selectedSubscriptionTiers.some(
                      (tier) => tier.id === subscriptionTier.id,
                    )}
                    selectTier={addSubscriptionTier}
                    deselectTier={removeSubscriptionTier}
                  />
                </ListItem>
              ))}
            </List>
          </div>
        </div>
      </div>
    </div>
  )
}

const SubscriptionTierRow = ({
  selected,
  subscriptionTier,
  selectTier,
  deselectTier,
}: {
  subscriptionTier: Product & { type: SubscriptionTierType }
  selected: boolean
  selectTier: (
    subscriptionTiers: Product & { type: SubscriptionTierType },
  ) => void
  deselectTier: (
    subscriptionTier: Product & { type: SubscriptionTierType },
  ) => void
}) => {
  return (
    <div className="flex w-full flex-row items-center justify-between gap-x-2 text-sm">
      <div className="flex flex-row items-center gap-x-2">
        <SubscriptionGroupIcon type={subscriptionTier.type} />
        <span>{subscriptionTier.name}</span>
      </div>
      <div className="flex flex-row items-center gap-x-4">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => {
            if (Boolean(v)) {
              selectTier(subscriptionTier)
            } else {
              deselectTier(subscriptionTier)
            }
          }}
        />
      </div>
    </div>
  )
}
