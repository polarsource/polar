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
import { Pill } from 'polarkit/components/ui/atoms'
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
  const hasLimitations =
    licenseKey.limit_activations ||
    licenseKey.limit_usage ||
    licenseKey.expires_at

  const humanDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const onDeactivate = async (activationId: string) => {
    await api.users.deactivateLicenseKey({
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
          className="h-10 w-10 rounded-full bg-gray-50 text-sm dark:bg-gray-900"
          onClick={onCopyKey}
        >
          <ContentPasteOutlined fontSize="inherit" />
        </Button>
      </div>

      {hasLimitations && (
        <table>
          <tbody>
            {licenseKey.expires_at && (
              <tr>
                <td>
                  <strong className="w-1/2 text-xs font-medium uppercase text-gray-500">
                    Expires
                  </strong>
                </td>
                <td>
                  <p className="w-1/2">{humanDate(licenseKey.expires_at)}</p>
                </td>
              </tr>
            )}

            {licenseKey.limit_usage && (
              <tr>
                <td>
                  <strong className="w-1/2 text-xs font-medium uppercase text-gray-500">
                    Usage Limit
                  </strong>
                </td>
                <td>
                  <p className="w-1/2">
                    {licenseKey.usage} / {licenseKey.limit_usage}
                  </p>
                </td>
              </tr>
            )}

            {licenseKey.limit_activations && (
              <tr>
                <td>
                  <strong className="w-1/2 text-xs font-medium uppercase text-gray-500">
                    Activation Limit
                  </strong>
                </td>
                <td>
                  <p className="w-1/2">{licenseKey.limit_activations}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {hasActivations && (
        <>
          <hr className="my-4" />
          <h3 className="font-display mb-4 text-sm">Activation Instances</h3>
          <table>
            <tbody>
              {activations.map((activation) => (
                <tr key={activation.id}>
                  <td>
                    <Pill color="gray">{activation.label}</Pill>
                  </td>
                  <td>{humanDate(activation.created_at)}</td>
                  <td>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        onDeactivate(activation.id)
                      }}
                    >
                      <CloseOutlined />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
