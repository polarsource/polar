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

import { CloseOutlined, ContentPasteOutlined } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'

import { useCallback } from 'react'

import { useState } from 'react'

import { useLicenseKey } from '@/hooks/queries'
import { Separator } from 'polarkit/components/ui/separator'

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
  const hasLimitations =
    licenseKey.limit_activations ||
    licenseKey.limit_usage ||
    licenseKey.expires_at

  const humanDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const onDeactivate = async (activationId: string) => {
    await api.usersLicenseKeys.deactivate({
      body: {
        key: licenseKey.key,
        organization_id: licenseKey.organization_id,
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
    <>
      <div className="flex flex-row items-center space-x-2">
        <Input value={licenseKey.key} readOnly />
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10"
          onClick={onCopyKey}
        >
          <ContentPasteOutlined fontSize="inherit" />
        </Button>
      </div>

      {hasLimitations && (
        <div className="flex flex-col gap-y-2">
          {licenseKey.expires_at && (
            <div className="flex flex-row items-baseline justify-between">
              <h3>Expires</h3>
              <span>{humanDate(licenseKey.expires_at)}</span>
            </div>
          )}
          {licenseKey.limit_usage && (
            <div className="flex flex-row items-baseline justify-between">
              <h3>Usage Limit</h3>
              <span>
                {licenseKey.usage} / {licenseKey.limit_usage}
              </span>
            </div>
          )}
          {licenseKey.limit_activations && (
            <div className="flex flex-row items-baseline justify-between">
              <h3>Activation Limit</h3>
              <span>{licenseKey.limit_activations}</span>
            </div>
          )}
        </div>
      )}

      {hasActivations && (
        <>
          <Separator />
          <h3 className="text-lg">Activation Instances</h3>
          <div className="flex flex-col gap-y-2">
            {activations.map((activation) => (
              <div
                className="flex flex-row items-baseline justify-between"
                key={activation.id}
              >
                <h3>{activation.label}</h3>
                <div className="flex flex-row items-center gap-x-4">
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    {humanDate(activation.created_at)}
                  </span>
                  <Button
                    className="h-6 w-6"
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      onDeactivate(activation.id)
                    }}
                  >
                    <CloseOutlined fontSize="inherit" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
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
    <div className="flex w-full flex-col gap-y-6">
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
