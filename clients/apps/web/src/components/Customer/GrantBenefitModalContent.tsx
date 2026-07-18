'use client'

import BenefitSelector from '@/components/Benefit/BenefitSelector'
import { GrantBenefitSelectedItem } from '@/components/Customer/GrantBenefitSelectedItem'
import { useCreateBenefitGrants } from '@/hooks/queries/benefits'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button, Input, Switch, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { useToast } from '../Toast/use-toast'

interface GrantBenefitModalContentProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
  hideModal: () => void
}

function getErrorMessage(detail: unknown): string {
  if (isValidationError(detail)) {
    return detail.map((error) => error.msg).join(' ')
  }
  if (typeof detail === 'string') {
    return detail
  }
  return 'Something went wrong. Please try again.'
}

const GrantBenefitModalContent = ({
  organization,
  customer,
  hideModal,
}: GrantBenefitModalContentProps) => {
  const { toast } = useToast()
  const [selected, setSelected] = useState<schemas['Benefit'][]>([])
  const [hasExpiration, setHasExpiration] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const createBenefitGrants = useCreateBenefitGrants()

  const addBenefit = (
    _benefitId: string | null,
    benefit?: schemas['Benefit'] | null,
  ) => {
    if (!benefit) {
      return
    }
    setErrorMessage(null)
    setSelected((prev) =>
      prev.some((b) => b.id === benefit.id) ? prev : [...prev, benefit],
    )
  }

  const removeBenefit = (benefitId: string) =>
    setSelected((prev) => prev.filter((b) => b.id !== benefitId))

  const onSubmit = async () => {
    if (selected.length === 0 || (hasExpiration && !expiresAt)) {
      return
    }
    setErrorMessage(null)

    const result = await createBenefitGrants.mutateAsync({
      customer_id: customer.id,
      grants: selected.map((benefit) => ({
        benefit_id: benefit.id,
      })),
      expires_at:
        hasExpiration && expiresAt
          ? new Date(expiresAt).toISOString()
          : undefined,
      reason: reason.trim() || undefined,
    })

    if (result.error) {
      setErrorMessage(getErrorMessage(result.error.detail))
      return
    }

    const plural = selected.length > 1
    toast({
      title: plural ? 'Benefits granted' : 'Benefit granted',
      description: plural
        ? 'The benefits are being granted to the customer.'
        : 'The benefit is being granted to the customer.',
    })
    hideModal()
  }

  const excludeIds = useMemo(
    () => selected.map((benefit) => benefit.id),
    [selected],
  )

  const canSubmit =
    selected.length > 0 &&
    (!hasExpiration || expiresAt.length > 0) &&
    !createBenefitGrants.isPending

  return (
    <Box flexDirection="column" height="100%">
      <Box
        flexDirection="column"
        rowGap="s"
        padding="2xl"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text variant="heading-xxs" as="h2">
          Grant benefits
        </Text>
        <Text color="muted">
          Grant one or more benefits to {customer.email} manually, independent
          of any subscription or order.
        </Text>
      </Box>

      <Box
        flexDirection="column"
        rowGap="xl"
        padding="2xl"
        flexGrow={1}
        overflowY="auto"
      >
        <Box flexDirection="column" rowGap="s">
          <Text variant="label">Add benefits</Text>
          <BenefitSelector
            organizationId={organization.id}
            value={null}
            excludeIds={excludeIds}
            onChange={addBenefit}
            placeholder="Search benefits to grant"
          />
          <Text variant="caption" color="muted">
            Only feature flag, custom and license key benefits can be granted
            manually.
          </Text>
        </Box>

        <Box flexDirection="column" rowGap="s">
          <Box alignItems="center" justifyContent="between">
            <Text variant="label">Selected benefits</Text>
            {selected.length > 0 && (
              <Text variant="caption" color="muted">
                {selected.length} selected
              </Text>
            )}
          </Box>
          {selected.length === 0 ? (
            <Box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              rowGap="xs"
              paddingVertical="2xl"
              paddingHorizontal="l"
              borderRadius="m"
              borderWidth={1}
              borderStyle="dashed"
              borderColor="border-primary"
              textAlign="center"
            >
              <Text variant="caption" color="muted">
                No benefits selected yet
              </Text>
              <Text variant="caption" color="muted">
                Add benefits above to grant them all at once.
              </Text>
            </Box>
          ) : (
            <Box as="ul" flexDirection="column" rowGap="s">
              {selected.map((benefit) => (
                <GrantBenefitSelectedItem
                  key={benefit.id}
                  benefit={benefit}
                  onRemove={removeBenefit}
                />
              ))}
            </Box>
          )}
        </Box>

        <Box flexDirection="column" rowGap="m">
          <Box alignItems="center" justifyContent="between" columnGap="m">
            <Box flexDirection="column">
              <Text variant="label">Set an expiration</Text>
              <Text variant="caption" color="muted">
                Automatically revoke these benefits at a chosen time.
              </Text>
            </Box>
            <Switch
              checked={hasExpiration}
              onCheckedChange={setHasExpiration}
              aria-label="Set an expiration"
            />
          </Box>
          {hasExpiration && (
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          )}
        </Box>

        <Box flexDirection="column" rowGap="s">
          <Text variant="label">Reason</Text>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this benefit being granted?"
            maxLength={500}
          />
          <Text variant="caption" color="muted">
            Optional. Stored with the grant request for audit purposes.
          </Text>
        </Box>

        {errorMessage && (
          <Text variant="caption" color="danger">
            {errorMessage}
          </Text>
        )}
      </Box>

      <Box
        columnGap="m"
        padding="2xl"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Button
          onClick={onSubmit}
          loading={createBenefitGrants.isPending}
          disabled={!canSubmit}
        >
          {selected.length > 1
            ? `Grant ${selected.length} benefits`
            : 'Grant benefit'}
        </Button>
        <Button variant="ghost" type="button" onClick={hideModal}>
          Cancel
        </Button>
      </Box>
    </Box>
  )
}

export default GrantBenefitModalContent
