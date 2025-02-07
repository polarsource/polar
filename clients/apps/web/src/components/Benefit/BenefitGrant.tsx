import { useCustomerBenefitGrantUpdate } from '@/hooks/queries'
import { Client, components } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { usePathname } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import DownloadablesBenefitGrant from './Downloadables/DownloadablesBenefitGrant'
import { LicenseKeyBenefitGrant } from './LicenseKeys/LicenseKeyBenefitGrant'
import { benefitsDisplayNames, resolveBenefitIcon } from './utils'

interface BenefitGrantProps {
  api: Client
  benefitGrant: components['schemas']['CustomerBenefitGrant']
}

const BenefitGrantCustom = ({
  benefitGrant,
}: {
  benefitGrant: components['schemas']['CustomerBenefitGrantCustom']
}) => {
  const {
    benefit: {
      properties: { note },
    },
  } = benefitGrant
  if (!note) {
    return null
  }
  return (
    <ShadowBox className="dark:bg-polar-800 bg-white p-4 text-sm lg:rounded-3xl">
      <p className="whitespace-pre-line">{note}</p>
    </ShadowBox>
  )
}

const BenefitGrantOAuth = ({
  api,
  benefitGrant,
  platform,
  connectButtonText,
  openButtonUrl,
  openButtonText,
  selectPlaceholder,
}: {
  api: Client
  benefitGrant:
    | components['schemas']['CustomerBenefitGrantGitHubRepository']
    | components['schemas']['CustomerBenefitGrantDiscord']
  platform: 'github' | 'discord'
  openButtonText: string
  openButtonUrl: string
  connectButtonText: string
  selectPlaceholder: string
}) => {
  const pathname = usePathname()
  const {
    customer,
    properties: { account_id },
    benefit: { type: benefitType },
  } = benefitGrant
  const accounts = useMemo(
    () =>
      customer
        ? Object.keys(customer.oauth_accounts || {})
            .filter((key) => key.startsWith(platform))
            .map((key) => customer.oauth_accounts[key])
        : [],
    [customer, platform],
  )

  const authorize = useCallback(async () => {
    const { data } = await api.GET(
      '/v1/customer-portal/oauth-accounts/authorize',
      {
        params: {
          query: {
            platform,
            return_to: pathname,
            customer_id: customer.id,
          },
        },
      },
    )
    if (data) {
      window.location.href = data.url
    }
  }, [customer, api, pathname, platform])

  const updateBenefitGrant = useCustomerBenefitGrantUpdate(api)
  const [selectedAccountKey, setSelectedAccountKey] = useState<
    string | undefined
  >(undefined)
  const onAccountSubmit = useCallback(async () => {
    if (!selectedAccountKey) {
      return
    }
    await updateBenefitGrant.mutateAsync({
      id: benefitGrant.id,
      body: {
        benefit_type: benefitType,
        properties: {
          account_id: selectedAccountKey,
        },
      },
    })
  }, [updateBenefitGrant, selectedAccountKey, benefitGrant.id, benefitType])

  return (
    <ShadowBox className="dark:bg-polar-800 bg-white p-4 text-sm lg:rounded-3xl">
      <div className="flex flex-row gap-2">
        {account_id && (
          <a href={openButtonUrl} target="_blank" rel="noopener noreferrer">
            <Button asChild size="lg">
              {openButtonText}
            </Button>
          </a>
        )}
        {!account_id && (
          <>
            {accounts.length === 0 ? (
              <Button
                type="button"
                onClick={authorize}
                size="lg"
                className="w-full"
              >
                {connectButtonText}
              </Button>
            ) : (
              <>
                <Select
                  onValueChange={(value) => {
                    if (value === 'add') {
                      authorize()
                    } else {
                      setSelectedAccountKey(value)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem
                        key={account.account_id}
                        value={account.account_id}
                      >
                        {account.account_username}
                      </SelectItem>
                    ))}
                    <SelectItem value="add">Connect new account</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" onClick={onAccountSubmit} size="lg">
                  Request my invite
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </ShadowBox>
  )
}

const BenefitGrantGitHubRepository = ({
  api,
  benefitGrant,
}: {
  api: Client
  benefitGrant: components['schemas']['CustomerBenefitGrantGitHubRepository']
}) => {
  const {
    benefit: {
      properties: { repository_owner, repository_name },
    },
  } = benefitGrant
  return (
    <BenefitGrantOAuth
      api={api}
      benefitGrant={benefitGrant}
      platform="github"
      connectButtonText="Connect GitHub account"
      openButtonText={`Go to ${repository_owner}/${repository_name}`}
      openButtonUrl={`https://github.com/${repository_owner}/${repository_name}/invitations`}
      selectPlaceholder="Select a GitHub account"
    />
  )
}

const BenefitGrantDiscord = ({
  api,
  benefitGrant,
}: {
  api: Client
  benefitGrant: components['schemas']['CustomerBenefitGrantDiscord']
}) => {
  const {
    benefit: {
      properties: { guild_id },
    },
  } = benefitGrant
  return (
    <BenefitGrantOAuth
      api={api}
      benefitGrant={benefitGrant}
      platform="discord"
      connectButtonText="Connect Discord account"
      openButtonText="Open Discord"
      openButtonUrl={`https://www.discord.com/channels/${guild_id}`}
      selectPlaceholder="Select a Discord account"
    />
  )
}

export const BenefitGrant = ({ api, benefitGrant }: BenefitGrantProps) => {
  const { benefit } = benefitGrant

  return (
    <div className={twMerge('flex w-full flex-col gap-4')}>
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-white">
          <span className="dark:bg-polar-700 flex h-8 w-8 flex-row items-center justify-center rounded-full bg-blue-50 text-sm">
            {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
          </span>
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium capitalize">
            {benefit.description}
          </h3>
          <p className="dark:text-polar-500 flex flex-row gap-x-1 truncate text-sm text-gray-500">
            {benefitsDisplayNames[benefit.type]}
          </p>
        </div>
      </div>
      {benefit.type === 'custom' && (
        <BenefitGrantCustom
          benefitGrant={
            benefitGrant as components['schemas']['CustomerBenefitGrantCustom']
          }
        />
      )}
      {benefit.type === 'downloadables' && (
        <DownloadablesBenefitGrant
          api={api}
          benefitGrant={
            benefitGrant as components['schemas']['CustomerBenefitGrantDownloadables']
          }
        />
      )}
      {benefit.type === 'license_keys' && (
        <LicenseKeyBenefitGrant
          api={api}
          benefitGrant={
            benefitGrant as components['schemas']['CustomerBenefitGrantLicenseKeys']
          }
        />
      )}
      {benefit.type === 'github_repository' && (
        <BenefitGrantGitHubRepository
          api={api}
          benefitGrant={
            benefitGrant as components['schemas']['CustomerBenefitGrantGitHubRepository']
          }
        />
      )}
      {benefit.type === 'discord' && (
        <BenefitGrantDiscord
          api={api}
          benefitGrant={
            benefitGrant as components['schemas']['CustomerBenefitGrantDiscord']
          }
        />
      )}
    </div>
  )
}
