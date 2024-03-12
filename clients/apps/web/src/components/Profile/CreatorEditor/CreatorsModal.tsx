import SubscriptionTierPill from '@/components/Subscriptions/SubscriptionTierPill'
import { useAuth } from '@/hooks'
import { CloseOutlined } from '@mui/icons-material'
import { Organization, Platforms, SubscriptionTier } from '@polar-sh/sdk'
import { api } from 'polarkit'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Banner } from 'polarkit/components/ui/molecules'
import { Separator } from 'polarkit/components/ui/separator'
import {
  useGetOrganization,
  useOrganization,
  useOrganizationSubscriptions,
  useUserSubscriptions,
} from 'polarkit/hooks'
import { useState } from 'react'

export interface CreatorsModalProps {
  creators: Organization[]
  organization: Organization
  hideModal: () => void
  setCreators: (producer: (creators: Organization[]) => Organization[]) => void
}

export const CreatorsModal = ({
  creators,
  organization,
  hideModal,
  setCreators,
}: CreatorsModalProps) => {
  const [username, setUsername] = useState('')
  const [showOrgNotFound, toggleOrgNotFound] = useState(false)
  const auth = useAuth()

  const userSubscriptions =
    useUserSubscriptions(auth.currentUser?.id, undefined, 9999).data?.items ||
    []
  const organizationSubscriptions =
    useOrganizationSubscriptions(auth.currentUser?.id, undefined, 9999).data
      ?.items || []

  const subscriptions = organization.is_personal
    ? userSubscriptions
    : organizationSubscriptions

  const addCreator = (organizationName: string) => {
    toggleOrgNotFound(false)

    if (creators.find((c) => c.name === organizationName)) {
      return
    }

    api.organizations
      .lookup({
        organizationName,
        platform: Platforms.GITHUB,
      })
      .then((org) => {
        setCreators((creators) => [...creators, org])
      })
      .catch((e) => {
        toggleOrgNotFound(true)
      })
  }

  const removeCreator = (creator: Organization) => {
    setCreators((creators) => creators.filter((c) => c.id !== creator.id))
  }

  return (
    <div className="relative flex flex-col gap-y-8 p-10">
      <div className="absolute right-6 top-6">
        <Button onClick={hideModal} size="icon" variant="ghost">
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
          <Button onClick={(e) => addCreator(username)}>Add</Button>
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
              <div className="flex flex-col">
                {creators.map((creator) => (
                  <CreatorRow
                    key={creator.id}
                    organizationId={creator.id}
                    onRemove={removeCreator}
                  />
                ))}
              </div>
            </div>
          )}
          {subscriptions.length > 0 && (
            <>
              <Separator className="dark:bg-polar-600" />
              <div className="flex flex-col gap-y-4">
                <h3>Subscriptions</h3>
                <div className="flex flex-col">
                  {subscriptions.map((subscription) => (
                    <SubscriptionOrganization
                      key={subscription.subscription_tier.id}
                      subscriptionTier={subscription.subscription_tier}
                      selected={creators.some(
                        (creator) =>
                          creator.id ===
                          subscription.subscription_tier.organization_id,
                      )}
                      selectOrganization={setCreators}
                      deselectOrganization={removeCreator}
                    />
                  ))}
                </div>
              </div>
            </>
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
  const creator = useGetOrganization(organizationId).data

  if (!creator) {
    return null
  }

  return (
    <div className="dark:hover:bg-polar-700 dark:text-polar-50 flex flex-row items-center justify-between gap-x-2 rounded-lg px-4 py-3 text-sm text-gray-950 hover:bg-gray-100">
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
        onClick={(e) => onRemove(creator)}
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
  subscriptionTier: SubscriptionTier
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
    <div className="dark:hover:bg-polar-700 dark:text-polar-50 flex flex-row items-center justify-between gap-x-2 rounded-lg px-4 py-3 text-sm text-gray-950 hover:bg-gray-100">
      <div className="flex flex-row items-center gap-x-2">
        <Avatar
          className="h-8 w-8"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
        <span>{organization.name}</span>
      </div>
      <div className="flex flex-row items-center gap-x-4">
        <SubscriptionTierPill subscriptionTier={subscriptionTier} />
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
