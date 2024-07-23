import ProductPill from '@/components/Products/ProductPill'
import { useOrganization, useUserSubscriptions } from '@/hooks/queries'
import { api } from '@/utils/api'
import { getOrganizationBySlug } from '@/utils/organization'
import { CloseOutlined } from '@mui/icons-material'
import { Organization, Product } from '@polar-sh/sdk'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Banner } from 'polarkit/components/ui/molecules'
import { useState } from 'react'

export interface CreatorsModalProps {
  creators: Organization[]
  organization: Organization
  hideModal: () => void
  setCreators: (producer: (creators: Organization[]) => Organization[]) => void
}

export const CreatorsModal = ({
  creators,
  hideModal,
  setCreators,
}: CreatorsModalProps) => {
  const [username, setUsername] = useState('')
  const [showOrgNotFound, toggleOrgNotFound] = useState(false)

  const subscriptions = useUserSubscriptions().data?.items || []

  const addCreator = async (organizationName: string) => {
    toggleOrgNotFound(false)

    if (creators.find((c) => c.slug === organizationName)) {
      return
    }

    const organization = await getOrganizationBySlug(api, organizationName)
    if (!organization) {
      toggleOrgNotFound(true)
      return
    }
    setCreators((creators) => [...creators, organization])
  }

  const removeCreator = (creator: Organization) => {
    setCreators((creators) => creators.filter((c) => c.id !== creator.id))
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
        <h3>Featured Developers</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select developers that you want to feature on the profile. The
          developer must be on Polar.
        </p>
      </div>
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center gap-x-4">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="GitHub Username or Organization Name"
          />
          <Button onClick={() => addCreator(username)}>Add</Button>
        </div>
        {showOrgNotFound && (
          <Banner color="red">User or Organization not found</Banner>
        )}
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[420px] w-full flex-col gap-y-6 overflow-y-auto">
          {creators.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <h3>Selected Developers</h3>
              <List size="small">
                {creators.map((creator) => (
                  <ListItem key={creator.id} size="small">
                    <CreatorRow
                      organizationId={creator.id}
                      onRemove={removeCreator}
                    />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
          {subscriptions.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <h3>Subscriptions</h3>
              <List size="small">
                {subscriptions.map((subscription) => (
                  <ListItem
                    key={subscription.product.id}
                    selected={creators.some(
                      (creator) =>
                        creator.id === subscription.product.organization_id,
                    )}
                    size="small"
                  >
                    <SubscriptionOrganization
                      subscriptionTier={subscription.product}
                      selected={creators.some(
                        (creator) =>
                          creator.id === subscription.product.organization_id,
                      )}
                      selectOrganization={setCreators}
                      deselectOrganization={removeCreator}
                    />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const CreatorRow = ({
  organizationId,
  onRemove,
}: {
  organizationId: string
  onRemove: (creator: Organization) => void
}) => {
  const creator = useOrganization(organizationId).data

  if (!creator) {
    return null
  }

  return (
    <div className="flex w-full flex-row items-center justify-between gap-x-2 text-sm">
      <div className="flex flex-row items-center gap-x-2">
        <Avatar
          className="h-8 w-8"
          avatar_url={creator.avatar_url}
          name={creator.name}
        />
        <span>{creator.name}</span>
      </div>
      <Button
        className="h-6 w-6"
        onClick={() => onRemove(creator)}
        variant="secondary"
        size="icon"
      >
        <CloseOutlined fontSize="inherit" />
      </Button>
    </div>
  )
}

const SubscriptionOrganization = ({
  selected,
  subscriptionTier,
  selectOrganization,
  deselectOrganization,
}: {
  subscriptionTier: Product
  selected: boolean
  selectOrganization: (
    producer: (organizations: Organization[]) => Organization[],
  ) => void
  deselectOrganization: (organization: Organization) => void
}) => {
  const organization = useOrganization(
    subscriptionTier.organization_id ?? '',
  ).data

  if (!organization) {
    return null
  }

  return (
    <div className="flex w-full flex-row items-center justify-between gap-x-2 text-sm">
      <div className="flex flex-row items-center gap-x-2">
        <Avatar
          className="h-8 w-8"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
        <span>{organization.name}</span>
      </div>
      <div className="flex flex-row items-center gap-x-4">
        <ProductPill product={subscriptionTier} />
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => {
            if (Boolean(v)) {
              selectOrganization((creators) => [...creators, organization])
            } else {
              deselectOrganization(organization)
            }
          }}
        />
      </div>
    </div>
  )
}
