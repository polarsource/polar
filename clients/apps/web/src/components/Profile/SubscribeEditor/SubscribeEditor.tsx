import revalidate from '@/app/actions'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useUpdateOrganization } from '@/hooks/queries'
import { CloseOutlined, SettingsOutlined } from '@mui/icons-material'
import {
  ListResourceOrganizationCustomer,
  Organization,
  OrganizationSubscribePromoteSettings,
  Product,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { Switch } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { FreeTierSubscribe } from '../../Organization/FreeTierSubscribe'

const getDefaultSettings = (
  organization: Organization,
): OrganizationSubscribePromoteSettings => {
  return (
    organization.profile_settings?.subscribe ?? {
      promote: true,
      show_count: true,
      count_free: true,
    }
  )
}

export interface SubscribeEditorProps {
  organization: Organization
  customerList: ListResourceOrganizationCustomer | undefined
  products: Product[]
  isAdmin: boolean
}

export const SubscribeEditor = ({
  organization,
  customerList,
  products,
  isAdmin,
}: SubscribeEditorProps) => {
  const isSubscriptionsEnabled =
    organization.feature_settings?.subscriptions_enabled
  if (!isSubscriptionsEnabled) {
    return null
  }

  const settings = getDefaultSettings(organization)
  const freeSubscriptionTier = products.find(
    (tier) => tier.type === SubscriptionTierType.FREE,
  )
  const customerCount = customerList?.items?.length ?? 0
  const showCount = customerList && customerCount && settings.show_count

  return (
    <div className="flex w-full flex-col gap-y-6">
      {settings.promote && freeSubscriptionTier && !isAdmin ? (
        <FreeTierSubscribe
          product={freeSubscriptionTier}
          organization={organization}
          upsellSubscriptions
        />
      ) : null}
      <div className="flex flex-row items-center gap-x-4">
        {showCount && (
          <>
            <div className="flex w-fit flex-shrink-0 flex-row items-center md:hidden lg:flex">
              {customerList.items?.map((user, i, array) => (
                <Avatar
                  className={twMerge(
                    'h-10 w-10',
                    i !== array.length - 1 && '-mr-3',
                  )}
                  key={i}
                  name={user.public_name ?? ''}
                  avatar_url={user.avatar_url}
                  height={30}
                  width={30}
                />
              ))}
            </div>
            <p className="text-sm font-medium">
              {Intl.NumberFormat('en-US', {
                notation: 'compact',
                compactDisplay: 'short',
              }).format(customerList.pagination.total_count)}{' '}
              <span className="font-light">
                {customerList.pagination.total_count === 1
                  ? 'Subscriber'
                  : 'Subscribers'}
              </span>
            </p>
          </>
        )}
        {isAdmin && (
          <SubscribeAdminSettings
            organization={organization}
            showTip={!customerCount}
          />
        )}
      </div>
    </div>
  )
}

const SubscribeAdminSettings = ({
  organization,
  showTip,
}: {
  organization: Organization
  showTip: boolean
}) => {
  const updateOrganizationMutation = useUpdateOrganization()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const [settings, setSettings] =
    useState<OrganizationSubscribePromoteSettings>(
      getDefaultSettings(organization),
    )

  const updateSettings = (onSuccess: () => void) => {
    updateOrganizationMutation
      .mutateAsync(
        {
          id: organization.id,
          settings: {
            profile_settings: {
              subscribe: settings,
            },
          },
        },
        {
          onSuccess: (updated: Organization) => {
            setSettings(getDefaultSettings(updated))
            onSuccess()
          },
        },
      )
      .then(() => revalidate(`organization:${organization.slug}`))
  }

  return (
    <>
      <a
        className="flex cursor-pointer flex-row items-center gap-x-2 text-sm text-gray-600 dark:text-gray-400"
        onClick={showModal}
      >
        <SettingsOutlined fontSize="small" className="mr-2" />
        {showTip && <span>Subscription promotion</span>}
      </a>
      <Modal
        className="lg:max-w-md"
        isShown={isModalShown}
        hide={hideModal}
        modalContent={
          <SubscribeSettingsModal
            settings={settings}
            setSettings={setSettings}
            saveSettings={updateSettings}
            hideModal={hideModal}
          />
        }
      />
    </>
  )
}

const SubscribeSettingsModal = ({
  settings,
  setSettings,
  saveSettings,
  hideModal,
}: {
  settings: OrganizationSubscribePromoteSettings
  setSettings: (settings: OrganizationSubscribePromoteSettings) => void
  saveSettings: (onSuccess: () => void) => void
  hideModal: () => void
}) => {
  const [isSaving, setIsSaving] = useState(false)
  const onSubmit = async () => {
    setIsSaving(true)
    saveSettings(() => {
      setIsSaving(false)
    })
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
        <h3>Subscription Promotion</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Customize how you want to attract more subscribers.
        </p>
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[420px] w-full flex-col gap-y-6 overflow-y-auto">
          <SettingsRow
            settings={settings}
            setSettings={setSettings}
            settingKey="promote"
            title="Promote Free Email Subscription"
            description="Increase conversion of visitors to subscribers"
          />

          <SettingsRow
            settings={settings}
            setSettings={setSettings}
            settingKey="show_count"
            title="Show subscriber count"
            description="Add social proof for others to follow"
          />

          <SettingsRow
            settings={settings}
            setSettings={setSettings}
            settingKey="count_free"
            title="Count free subscriptions"
            description="Include free subscriptions in public count"
          />
        </div>

        <Button onClick={onSubmit} loading={isSaving}>
          Save
        </Button>
      </div>
    </div>
  )
}

const SettingsRow = ({
  settings,
  setSettings,
  settingKey,
  title,
  description,
}: {
  settings: OrganizationSubscribePromoteSettings
  setSettings: (settings: OrganizationSubscribePromoteSettings) => void
  settingKey: 'promote' | 'show_count' | 'count_free'
  title: string
  description: string
}) => {
  const checked = settings[settingKey]
  const onChange = (checked: boolean) => {
    setSettings({
      ...settings,
      [settingKey]: checked,
    })
  }

  return (
    <div className="flex flex-row items-center">
      <label
        htmlFor={`subscribe-${settingKey}`}
        className="flex grow flex-col text-sm font-medium"
      >
        {title}
        {description && (
          <span className="font-normal text-gray-500">{description}</span>
        )}
      </label>
      <Switch
        id={`subscribe-${settingKey}`}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  )
}
