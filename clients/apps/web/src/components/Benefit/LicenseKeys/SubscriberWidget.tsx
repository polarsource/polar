import { api } from '@/utils/api'
import {
  BenefitGrantLicenseKeys,
  BenefitLicenseKeysSubscriber,
  LicenseKeyActivationBase,
  LicenseKeyWithActivations,
  UserOrder,
  UserSubscription,
} from '@polar-sh/sdk'

import { useState } from 'react'

import { useLicenseKey } from '@/hooks/queries'

export const getLicenseKeyGrant = (
  benefit: BenefitLicenseKeysSubscriber,
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
  const deactivate = async (activationId: string) => {
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

  if (!licenseKey) {
    return <></>
  }

  return (
    <div>
      <p>{licenseKey.key}</p>
      {hasActivations && (
        <ul>
          {activations.map((activation) => (
            <li key={activation.id}>
              {activation.label}
              <button
                onClick={() => {
                  deactivate(activation.id)
                }}
              >
                Deactivate
              </button>
            </li>
          ))}
        </ul>
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
