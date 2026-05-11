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
    <Text variant="label">{title}</Text>
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
        description="We recommend setting up webhooks to keep your system in sync with Polar. Without them, we can't see how fulfillment is automated, which can raise questions during review."
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
        title="Show us your setup is ready"
        description="Pick whichever path matches how you fulfill orders. You only need one."
      />
      <Box display="flex" flexDirection="column" rowGap="s">
        <PathCard
          title="Sell via a checkout link"
          description="Attach a product with at least one benefit (license key, GitHub, Discord, custom, or downloadables) to a checkout link."
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
          description="Create an organization access token and a webhook endpoint so we can see your integration is wired up."
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
