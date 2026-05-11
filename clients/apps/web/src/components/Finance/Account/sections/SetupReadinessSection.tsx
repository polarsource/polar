'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowRight, PlugIcon, WebhookIcon } from 'lucide-react'
import Link from 'next/link'
import { StatusBlock } from './StatusBlock'

const WEBHOOK_MISSING_REASON: schemas['OrganizationReviewCheckReason'] =
  'setup_readiness.webhook_missing'

interface Props {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
}

interface PathCardLink {
  label: string
  href: string
}

const PathCard = ({
  title,
  description,
  links,
}: {
  title: string
  description: string
  links: PathCardLink[]
}) => (
  <Box
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    borderRadius="m"
    padding="l"
    display="flex"
    flexDirection="column"
    rowGap="xs"
  >
    <Text variant="label" color="default">
      {title}
    </Text>
    <Text variant="caption" color="muted">
      {description}
    </Text>
    <Box display="flex" columnGap="s" marginTop="xs">
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          <Button size="sm" variant="secondary">
            {link.label}
          </Button>
        </Link>
      ))}
    </Box>
  </Box>
)

export const SetupReadinessSection = ({ organization, step }: Props) => {
  if (step.reasons?.includes(WEBHOOK_MISSING_REASON)) {
    return (
      <StatusBlock
        tone="warning"
        icon={WebhookIcon}
        title="Add a webhook endpoint"
        description="Webhooks keep your backend in sync with Polar — refunds, cancellations, and renewals. You can fulfill orders without one, but we recommend adding one so reviewers can verify your integration."
        action={
          <Link
            href={`/dashboard/${organization.slug}/settings/webhooks/endpoints`}
          >
            <Button>
              Configure webhooks
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        }
      />
    )
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="m">
      <StatusBlock
        tone="neutral"
        icon={PlugIcon}
        title="Connect your fulfillment"
        description="Set up one of these paths so we can see how orders are delivered."
      />
      <Box display="flex" flexDirection="column" rowGap="s">
        <PathCard
          title="Sell via a checkout link"
          description="Attach a Polar-fulfilled benefit (downloadables, license keys, GitHub access, or Discord) to a product, then create a checkout link for it."
          links={[
            {
              label: 'Checkout links',
              href: `/dashboard/${organization.slug}/products/checkout-links`,
            },
            {
              label: 'Benefits',
              href: `/dashboard/${organization.slug}/products/benefits`,
            },
          ]}
        />
        <PathCard
          title="Integrate via the API"
          description="Create an organization access token and a webhook endpoint so we can verify your integration."
          links={[
            {
              label: 'Access tokens',
              href: `/dashboard/${organization.slug}/settings#developers`,
            },
            {
              label: 'Webhooks',
              href: `/dashboard/${organization.slug}/settings/webhooks/endpoints`,
            },
          ]}
        />
      </Box>
    </Box>
  )
}
