'use client'

import { benefitsDisplayNames } from '@/components/Benefit/utils'
import { toast } from '@/components/Toast/use-toast'
import {
  useCreateBenefitGrant,
  useInfiniteBenefits,
} from '@/hooks/queries/benefits'
import { useMembers } from '@/hooks/queries/members'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { enums, schemas } from '@polar-sh/client'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@polar-sh/ui/components/ui/sheet'
import { useDeferredValue, useId, useState } from 'react'

const manualBenefitTypes = enums.benefitTypeValues.filter(
  (type) => type !== 'meter_credit',
)

export const GrantBenefitSheet = ({
  customer,
}: {
  customer: schemas['Customer']
}) => {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">Grant benefit</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <GrantBenefitForm customer={customer} onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

const GrantBenefitForm = ({
  customer,
  onClose,
}: {
  customer: schemas['Customer']
  onClose: () => void
}) => {
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search.trim())
  const [benefitId, setBenefitId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [error, setError] = useState<string>()
  const benefitLabel = useId()
  const memberLabel = useId()
  const isTeam = customer.type === 'team'
  const benefits = useInfiniteBenefits(customer.organization_id, {
    query: query || undefined,
    type: manualBenefitTypes,
    sorting: ['description'],
  })
  const members = useMembers(isTeam ? customer.id : '')
  const benefitOptions =
    benefits.data?.pages.flatMap((page) => page.items) ?? []
  const memberOptions = members.data?.pages.flatMap((page) => page.items) ?? []
  const grant = useCreateBenefitGrant()
  const canSubmit = !!benefitId && (!isTeam || !!memberId) && !grant.isPending

  return (
    <Box
      as="form"
      flexDirection="column"
      rowGap="l"
      height="full"
      overflowY="auto"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit) return
        setError(undefined)
        grant.mutate(
          {
            customer_id: customer.id,
            benefit_id: benefitId,
            member_id: isTeam ? memberId : undefined,
          },
          {
            onSuccess: ({ error }) => {
              if (error) {
                setError(extractApiErrorMessage(error))
                return
              }
              toast({ title: 'Benefit grant requested' })
              onClose()
            },
            onError: () => setError('Could not grant the benefit. Try again.'),
          },
        )
      }}
    >
      <Box flexDirection="column" rowGap="xs">
        <SheetTitle>Grant benefit</SheetTitle>
        <SheetDescription>
          Choose a benefit to grant without a purchase.
        </SheetDescription>
      </Box>
      <Box flexDirection="column" rowGap="s">
        <Text as="span" id={benefitLabel}>
          Benefit
        </Text>
        <Input
          aria-label="Search benefits"
          placeholder="Search benefits"
          value={search}
          disabled={grant.isPending}
          onChange={(event) => {
            setSearch(event.target.value)
            setBenefitId('')
          }}
        />
        <Select
          value={benefitId}
          onValueChange={setBenefitId}
          disabled={grant.isPending || benefitOptions.length === 0}
        >
          <SelectTrigger aria-labelledby={benefitLabel}>
            <SelectValue placeholder="Select a benefit" />
          </SelectTrigger>
          <SelectContent>
            {benefitOptions.map((benefit) => (
              <SelectItem key={benefit.id} value={benefit.id}>
                {benefit.description} · {benefitsDisplayNames[benefit.type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {benefits.isLoading && (
          <Text variant="caption" color="muted">
            Loading benefits…
          </Text>
        )}
        {benefits.isError && (
          <Text variant="caption" role="alert">
            Could not load benefits.
          </Text>
        )}
        {benefits.isSuccess && benefitOptions.length === 0 && (
          <Text variant="caption" color="muted">
            No eligible benefits found.
          </Text>
        )}
        {benefits.hasNextPage && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={benefits.isFetchingNextPage}
            onClick={() => void benefits.fetchNextPage()}
          >
            Load more benefits
          </Button>
        )}
      </Box>
      {isTeam && (
        <Box flexDirection="column" rowGap="s">
          <Text as="span" id={memberLabel}>
            Member
          </Text>
          <Select
            value={memberId}
            onValueChange={setMemberId}
            disabled={grant.isPending}
          >
            <SelectTrigger aria-labelledby={memberLabel}>
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              {memberOptions.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {members.isError && (
            <Text variant="caption" role="alert">
              Could not load members.
            </Text>
          )}
          {members.hasNextPage && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={members.isFetchingNextPage}
              onClick={() => void members.fetchNextPage()}
            >
              Load more members
            </Button>
          )}
        </Box>
      )}
      {error && (
        <Text variant="caption" role="alert">
          {error}
        </Text>
      )}
      <Box columnGap="s" justifyContent="end">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={grant.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit} loading={grant.isPending}>
          Grant benefit
        </Button>
      </Box>
    </Box>
  )
}
