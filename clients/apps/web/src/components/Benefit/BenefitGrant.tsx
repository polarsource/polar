import { useCustomerBenefitGrantUpdate } from '@/hooks/queries'
import { markdownOptions } from '@/utils/markdown'
import { Client, schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Markdown from 'markdown-to-jsx'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DownloadablesBenefitGrant from './Downloadables/DownloadablesBenefitGrant'
import { LicenseKeyBenefitGrant } from './LicenseKeys/LicenseKeyBenefitGrant'
import { resolveBenefitIcon } from './utils'

interface BenefitGrantProps {
  api: Client
  benefitGrant: schemas['CustomerBenefitGrant']
  locale?: AcceptedLocale
}

const BenefitGrantCustom = ({
  benefitGrant,
}: {
  benefitGrant: schemas['CustomerBenefitGrantCustom']
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
    <ShadowBox className="dark:bg-polar-800 bg-white p-6 lg:rounded-3xl">
      <div className="prose dark:prose-invert prose-headings:font-medium prose-headings:text-black prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-sm prose-h5:text-sm prose-h6:text-sm dark:prose-headings:text-white dark:text-polar-300 prose-p:text-sm leading-normal text-gray-800 [&>*>*:first-child]:mt-0">
        <Markdown options={markdownOptions}>{note}</Markdown>
      </div>
    </ShadowBox>
  )
}

const BenefitGrantOAuth = ({
  api,
  benefitGrant,
  platform,
  locale = DEFAULT_LOCALE,
  connectButtonText,
  openButtonUrl,
  openButtonText,
  selectPlaceholder,
}: {
  api: Client
  benefitGrant:
    | schemas['CustomerBenefitGrantGitHubRepository']
    | schemas['CustomerBenefitGrantDiscord']
  platform: 'github' | 'discord'
  locale?: AcceptedLocale
  openButtonText: string
  openButtonUrl: string
  connectButtonText: string
  selectPlaceholder: string
}) => {
  const t = useTranslations(locale)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const {
    customer,
    properties: { account_id },
    benefit: { type: benefitType },
    error: grantError,
  } = benefitGrant
  const [showAccountSelector, setShowAccountSelector] = useState(
    !account_id || !!grantError,
  )
  const [retryCountdown, setRetryCountdown] = useState<number>(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const errorPlatform = searchParams.get('error_platform')
  const error = errorPlatform === platform ? searchParams.get('error') : null
  const retryAfter =
    errorPlatform === platform ? searchParams.get('error_retry_after') : null

  // Start countdown timer for rate limit errors
  useEffect(() => {
    const bail = () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }

    if (!retryAfter) {
      bail()
      return
    }

    const seconds = Math.round(parseFloat(retryAfter))

    if (isNaN(seconds) || seconds <= 0) {
      bail()
      return
    }

    setRetryCountdown(seconds)

    countdownRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return bail
  }, [retryAfter])

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

  const onAccountReset = useCallback(async () => {
    await updateBenefitGrant.mutateAsync({
      id: benefitGrant.id,
      body: {
        benefit_type: benefitType,
        properties: {
          account_id: null,
        },
      },
    })
    setShowAccountSelector(true)
  }, [updateBenefitGrant, benefitGrant.id, benefitType])

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
    setShowAccountSelector(false)
  }, [updateBenefitGrant, selectedAccountKey, benefitGrant.id, benefitType])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 lg:flex-row">
        {!showAccountSelector && (
          <>
            <a
              href={openButtonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="grow"
            >
              <Button asChild fullWidth variant="secondary">
                {openButtonText}
              </Button>
            </a>
            <Button
              onClick={onAccountReset}
              variant="secondary"
              className="grow"
            >
              {t('checkout.benefits.requestNewInvite')}
            </Button>
          </>
        )}
        {showAccountSelector && (
          <>
            {accounts.length === 0 ? (
              <Button
                type="button"
                onClick={authorize}
                fullWidth
                variant="secondary"
                disabled={retryCountdown > 0}
              >
                {retryCountdown > 0
                  ? t('checkout.benefits.retryIn', { count: retryCountdown })
                  : connectButtonText}
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
                    <SelectItem value="add">
                      {t('checkout.benefits.connectNewAccount')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={onAccountSubmit}
                  fullWidth
                  variant="secondary"
                >
                  {t('checkout.benefits.requestMyInvite')}
                </Button>
              </>
            )}
          </>
        )}
      </div>
      {(error || grantError) && (
        <p className="text-sm text-red-500 dark:text-red-400">
          {error || grantError?.message}
        </p>
      )}
    </div>
  )
}

const BenefitGrantGitHubRepository = ({
  api,
  benefitGrant,
  locale = DEFAULT_LOCALE,
}: {
  api: Client
  benefitGrant: schemas['CustomerBenefitGrantGitHubRepository']
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale)
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
      locale={locale}
      connectButtonText={t('checkout.benefits.github.connect')}
      openButtonText={t('checkout.benefits.github.goTo', {
        repository: `${repository_owner}/${repository_name}`,
      })}
      openButtonUrl={`https://github.com/${repository_owner}/${repository_name}/invitations`}
      selectPlaceholder={t('checkout.benefits.github.selectAccount')}
    />
  )
}

const BenefitGrantDiscord = ({
  api,
  benefitGrant,
  locale = DEFAULT_LOCALE,
}: {
  api: Client
  benefitGrant: schemas['CustomerBenefitGrantDiscord']
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale)
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
      locale={locale}
      connectButtonText={t('checkout.benefits.discord.connect')}
      openButtonText={t('checkout.benefits.discord.open')}
      openButtonUrl={`https://www.discord.com/channels/${guild_id}`}
      selectPlaceholder={t('checkout.benefits.discord.selectAccount')}
    />
  )
}

export const BenefitGrant = ({
  api,
  benefitGrant,
  locale = DEFAULT_LOCALE,
}: BenefitGrantProps) => {
  const t = useTranslations(locale)
  const { benefit } = benefitGrant

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex flex-row items-center gap-x-2 text-xs text-gray-500 dark:text-white">
          <span className="dark:bg-polar-700 flex h-8 w-8 flex-row items-center justify-center rounded-full bg-gray-50 text-sm">
            {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
          </span>
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium">{benefit.description}</h3>
          <p className="dark:text-polar-500 flex flex-row gap-x-1 truncate text-sm text-gray-500">
            {t(`benefitTypes.${benefit.type}`)}
          </p>
        </div>
      </div>
      {benefit.type === 'custom' && (
        <BenefitGrantCustom
          benefitGrant={benefitGrant as schemas['CustomerBenefitGrantCustom']}
        />
      )}
      {benefit.type === 'downloadables' && (
        <DownloadablesBenefitGrant
          api={api}
          benefitGrant={
            benefitGrant as schemas['CustomerBenefitGrantDownloadables']
          }
        />
      )}
      {benefit.type === 'license_keys' && (
        <LicenseKeyBenefitGrant
          api={api}
          benefitGrant={
            benefitGrant as schemas['CustomerBenefitGrantLicenseKeys']
          }
          locale={locale}
        />
      )}
      {benefit.type === 'github_repository' && (
        <BenefitGrantGitHubRepository
          api={api}
          benefitGrant={
            benefitGrant as schemas['CustomerBenefitGrantGitHubRepository']
          }
          locale={locale}
        />
      )}
      {benefit.type === 'discord' && (
        <BenefitGrantDiscord
          api={api}
          benefitGrant={benefitGrant as schemas['CustomerBenefitGrantDiscord']}
          locale={locale}
        />
      )}
    </div>
  )
}
