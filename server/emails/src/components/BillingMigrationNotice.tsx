import InfoBox from './InfoBox'
import { Text } from './foundation'

export function BillingMigrationNotice({
  organizationName,
  previousBillingProvider,
}: {
  organizationName: string
  previousBillingProvider: string
}) {
  return (
    <InfoBox title="Billing has moved to Polar">
      <Text>
        {organizationName} has migrated your subscription from{' '}
        {previousBillingProvider} to Polar. {previousBillingProvider} will no
        longer bill you.
      </Text>
    </InfoBox>
  )
}

export default BillingMigrationNotice
