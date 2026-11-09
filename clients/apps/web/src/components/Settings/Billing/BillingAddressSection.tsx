'use client'

import { useOrganizationBillingDetails } from '@/hooks/queries/billing'
import { formatCountry } from '@/utils/formatters'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { LoadingBox } from '../../Shared/LoadingBox'
import { SectionDescription } from '../Section'

const formatAddress = (
  details: ReturnType<typeof useOrganizationBillingDetails>['data'],
): { field: string; text: string }[] => {
  if (!details) return []
  const lines: { field: string; text: string }[] = []
  if (details.billing_name)
    lines.push({ field: 'name', text: details.billing_name })
  const a = details.billing_address
  if (!a) return lines
  if (a.line1) lines.push({ field: 'line1', text: a.line1 })
  if (a.line2) lines.push({ field: 'line2', text: a.line2 })
  const cityLine = [a.postal_code, a.city].filter(Boolean).join(' ')
  if (cityLine) lines.push({ field: 'city', text: cityLine })
  const regionLine = [a.state, formatCountry(a.country)]
    .filter(Boolean)
    .join(', ')
  lines.push({ field: 'region', text: regionLine })
  return lines
}

export const BillingAddressSection = ({
  organizationId,
  onEdit,
}: {
  organizationId: string
  onEdit: () => void
}) => {
  const { data: details, isLoading } =
    useOrganizationBillingDetails(organizationId)
  const lines = formatAddress(details)
  const hasAddress = lines.length > 0
  const taxId = details?.tax_id

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="start" justifyContent="between" columnGap="m">
        <SectionDescription
          title="Billing address"
          description="Used on invoices for your Polar subscription"
        />
        <Button variant="secondary" onClick={onEdit}>
          {hasAddress ? 'Edit' : 'Add address'}
        </Button>
      </Box>
      <Box
        flexDirection="column"
        rowGap="m"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        padding="xl"
      >
        {isLoading ? (
          <LoadingBox height={64} borderRadius="m" />
        ) : hasAddress ? (
          <Box flexDirection="column" rowGap="xs">
            {lines.map((line, idx) => (
              <Text key={line.field} color={idx === 0 ? 'default' : 'muted'}>
                {line.text}
              </Text>
            ))}
            {taxId && <Text color="muted">Tax ID: {taxId}</Text>}
          </Box>
        ) : (
          <Box display="block" paddingVertical="l" textAlign="center">
            <Text color="muted">No billing address on file</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}
