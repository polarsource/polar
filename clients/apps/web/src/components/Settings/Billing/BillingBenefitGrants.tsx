'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useOrganizationBenefitGrants,
  useUpdateOrganizationBenefitGrant,
  type OrganizationBenefitGrant,
} from '@/hooks/queries/billing'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { Section, SectionDescription } from '../Section'

const BenefitGrantContent = ({
  organizationId,
  grant,
}: {
  organizationId: string
  grant: OrganizationBenefitGrant
}) => {
  const updateGrant = useUpdateOrganizationBenefitGrant(organizationId)
  const [email, setEmail] = useState(grant.invited_email ?? '')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    try {
      await updateGrant.mutateAsync({
        benefitGrantId: grant.id,
        body: { invited_email: email },
      })
    } catch {
      toast({
        title: 'Could not request the Slack invite',
        description: 'Please try again in a moment.',
        variant: 'error',
      })
    }
  }

  if (grant.is_connected) {
    return (
      <Text color="muted">
        Connected to your Slack workspace
        {grant.channel_name ? (
          <>
            {' '}
            in channel <strong>{grant.channel_name}</strong>
          </>
        ) : null}
        .
      </Text>
    )
  }

  if (grant.is_granted) {
    return (
      <Box flexDirection="column" rowGap="s">
        <Text color="muted">
          Invite sent to {grant.invited_email}.
          {grant.channel_name ? ` Channel: ${grant.channel_name}.` : ''}{' '}
          {grant.invite_url
            ? 'Open the link to accept in Slack.'
            : 'Accept it from the invite email or your Slack Connect requests.'}
        </Text>
        {grant.invite_url && (
          <Box>
            <a
              href={grant.invite_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button asChild variant="secondary">
                Open Slack invite
              </Button>
            </a>
          </Box>
        )}
      </Box>
    )
  }

  if (grant.invited_email && !grant.error_message) {
    return (
      <Text color="muted">
        Setting up your Slack channel for <strong>{grant.invited_email}</strong>
        ... The invite will arrive in that inbox shortly.
      </Text>
    )
  }

  return (
    <Box as="form" flexDirection="column" rowGap="s" onSubmit={onSubmit}>
      {grant.invited_email ? (
        <Text color="muted">
          We couldn&apos;t set up your Slack channel with{' '}
          <strong>{grant.invited_email}</strong>. Double-check the email and try
          again.
        </Text>
      ) : (
        <Text color="muted">
          Enter the email of an admin in your Slack workspace. They&apos;ll
          receive a Slack Connect invite for a private channel.
        </Text>
      )}
      {grant.invited_email && grant.error_message && (
        <Text color="danger" variant="caption">
          {grant.error_message}
        </Text>
      )}
      <Box alignItems="center" columnGap="s">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="slack-admin@yourcompany.com"
        />
        <Button type="submit" loading={updateGrant.isPending}>
          {grant.invited_email ? 'Try again' : 'Request Slack invite'}
        </Button>
      </Box>
    </Box>
  )
}

export const BillingBenefitGrants = ({
  organizationId,
}: {
  organizationId: string
}) => {
  const { data } = useOrganizationBenefitGrants(organizationId)
  const grants = data?.items ?? []

  if (grants.length === 0) {
    return null
  }

  return (
    <Section id="benefit-grants">
      <Box flexDirection="column" rowGap="l">
        <SectionDescription
          title="Slack channel"
          description="Shared Slack Connect channel with the Polar team, included in your plan"
        />
        {grants.map((grant) => (
          <Box
            key={grant.id}
            flexDirection="column"
            rowGap="m"
            borderRadius="l"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            padding="xl"
          >
            <Text variant="heading-xs" as="h3">
              {grant.benefit_description}
            </Text>
            <BenefitGrantContent
              organizationId={organizationId}
              grant={grant}
            />
          </Box>
        ))}
      </Box>
    </Section>
  )
}
