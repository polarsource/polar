'use client'

import { useOrganizationBillingDetails } from '@/hooks/queries/billing'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { LoadingBox } from '../../Shared/LoadingBox'
import { SectionDescription } from '../Section'

const formatAddress = (
  details: ReturnType<typeof useOrganizationBillingDetails>['data'],
): string[] => {
  if (!details) return []
  const lines: string[] = []
  if (details.billing_name) lines.push(details.billing_name)
  const a = details.billing_address
  if (!a) return lines
  if (a.line1) lines.push(a.line1)
  if (a.line2) lines.push(a.line2)
  const cityLine = [a.postal_code, a.city].filter(Boolean).join(' ')
  if (cityLine) lines.push(cityLine)
  const regionLine = [a.state, a.country].filter(Boolean).join(', ')
  if (regionLine) lines.push(regionLine)
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
    <Box display="flex" flexDirection="column" rowGap="l">
      <Box
        display="flex"
        alignItems="start"
        justifyContent="between"
        columnGap="m"
      >
        <SectionDescription
          title="Billing address"
          description="Used on invoices for your Polar subscription"
        />
        <Button variant="secondary" onClick={onEdit}>
          {hasAddress ? 'Edit' : 'Add address'}
        </Button>
      </Box>
      <Box
        display="flex"
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
          <Box display="flex" flexDirection="column" rowGap="xs">
            {lines.map((line, idx) => (
              <Text key={idx} color={idx === 0 ? 'default' : 'muted'}>
                {line}
              </Text>
            ))}
            {taxId && (
              <Text color="muted" variant="caption">
                Tax ID: {taxId}
              </Text>
            )}
          </Box>
        ) : (
          <Box paddingVertical="l" textAlign="center">
            <Text color="muted">No billing address on file</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}
