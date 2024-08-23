import { api } from '@/utils/api'
import {
  BenefitGrantLicenseKeys,
  BenefitLicenseKeysSubscriber,
  LicenseKeyActivationBase,
  LicenseKeyWithActivations,
  UserBenefit,
  UserOrder,
  UserSubscription,
} from '@polar-sh/sdk'

import { ContentPasteOutlined } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'

import { useCallback } from 'react'

import { useState } from 'react'

import { useLicenseKey } from '@/hooks/queries'

export const getLicenseKeyGrant = (
  benefit: UserBenefit,
  order?: UserOrder,
  subscription?: UserSubscription,
) => {
  let licenseKeyGrant = undefined
  if (benefit.type === 'license_keys') {
    if (order) {
      licenseKeyGrant = benefit.grants
        .filter((grant) => grant.order_id === order.id)
        .pop()
    } else if (subscription) {
      licenseKeyGrant = benefit.grants
        .filter((grant) => grant.subscription_id === subscription.id)
        .pop()
    }
  }
  return licenseKeyGrant
}

const LicenseKey = ({
  licenseKey,
}: {
  licenseKey: LicenseKeyWithActivations
}) => {
  const [activations, setActivations] = useState<
    Array<LicenseKeyActivationBase>
  >(licenseKey?.activations ?? [])
  const hasActivations = activations.length > 0

  const onDeactivate = async (activationId: string) => {
    await api.users.deactivateLicenseKey({
      body: {
        key: licenseKey.key,
        activation_id: activationId,
      },
    })
    const newActivations = activations.filter(
      (activation) => activation.id !== activationId,
    )
    setActivations(newActivations)
  }

  const onCopyKey = useCallback(() => {
    navigator.clipboard.writeText(licenseKey.key ?? '')
  }, [licenseKey])

  if (!licenseKey) {
    return <></>
  }

  return (
    <div>
      <div className="flex flex-row items-center space-x-2">
        <Input value={licenseKey.key} readOnly />
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10 rounded-full bg-gray-50 text-sm dark:bg-gray-900"
          onClick={onCopyKey}
        >
          <ContentPasteOutlined fontSize="inherit" />
        </Button>
      </div>

      {licenseKey.expires_at && (
        <p>
          Expires: <span>{licenseKey.expires_at}</span>
        </p>
      )}

      {licenseKey.limit_usage && (
        <p>
          Usage:{' '}
          <span>
            {licenseKey.usage} / {licenseKey.limit_usage}
          </span>
        </p>
      )}

      {licenseKey.limit_activations && (
        <p>
          Activations limit: <span>{licenseKey.limit_activations}</span>
        </p>
      )}

      {hasActivations && (
        <>
          <hr />
          <ul>
            {activations.map((activation) => (
              <li key={activation.id}>
                {activation.label}
                <button
                  onClick={() => {
                    onDeactivate(activation.id)
                  }}
                >
                  Deactivate
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const LicenseKeysWidget = ({ grant }: { grant: BenefitGrantLicenseKeys }) => {
  const licenseKeyId = grant.properties.license_key_id
  const licenseKeyQuery = useLicenseKey({ licenseKeyId })
  const licenseKey = licenseKeyQuery.data

  if (licenseKeyQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  if (!licenseKey) {
    return <></>
  }

  return (
    <div className="flex w-full flex-col">
      <LicenseKey licenseKey={licenseKey} />
    </div>
  )
}

export const LicenseKeysSubscriberWidget = ({
  benefit,
  order,
  subscription,
}: {
  benefit: BenefitLicenseKeysSubscriber
  order?: UserOrder
  subscription?: UserSubscription
}) => {
  const licenseKeyGrant = getLicenseKeyGrant(benefit, order, subscription)
  if (!licenseKeyGrant) {
    return <></>
  }

  return <LicenseKeysWidget grant={licenseKeyGrant} />
}
