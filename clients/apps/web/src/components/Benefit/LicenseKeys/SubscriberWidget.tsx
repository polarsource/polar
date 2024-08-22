import {
  BenefitLicenseKeysSubscriber,
  LicenseKeyRead,
  UserOrder,
  UserSubscription,
} from '@polar-sh/sdk'

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

const LicenseKey = ({ licenseKey }: { licenseKey: LicenseKeyRead }) => {
  return (
    <div>
      <p>{licenseKey.key}</p>
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

  const licenseKeyId = licenseKeyGrant.properties.license_key_id
  const licenseKeyQuery = useLicenseKey(licenseKeyId)
  const licenseKey = licenseKeyQuery.data

  if (licenseKeyQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  return (
    <div className="flex w-full flex-col">
      <LicenseKey licenseKey={licenseKey} />
    </div>
  )
}
