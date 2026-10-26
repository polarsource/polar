'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useCreateOrganizationDomain,
  useOrganizationDomains,
  useVerifyOrganizationDomain,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check as CheckIcon } from '@polar-sh/orbit/icons'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import type { ComponentProps } from 'react'
import { SectionLayout } from './SectionLayout'

interface Props {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
  centered?: boolean
}

const CenteredLayout = ({
  description,
  children,
  footerEnd,
}: ComponentProps<typeof SectionLayout>) => (
  <>
    <p className="dark:text-polar-400 mx-auto max-w-sm text-sm text-balance text-gray-600">
      {description}
    </p>
    {children && <div className="mt-6">{children}</div>}
    {footerEnd && <div className="mt-6">{footerEnd}</div>}
  </>
)

export const DomainVerificationSection = ({
  organization,
  step,
  centered = false,
}: Props) => {
  const Layout = centered ? CenteredLayout : SectionLayout
  const { data: domains } = useOrganizationDomains(organization.id)
  const createDomain = useCreateOrganizationDomain(organization.id)
  const verifyDomain = useVerifyOrganizationDomain(organization.id)

  if (step.status === 'passed') {
    return (
      <>
        <span className="dark:bg-polar-700 mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
          <CheckIcon className="dark:text-polar-400 h-4 w-4 text-gray-500" />
        </span>
        <h4 className="mb-2 font-medium">Domain verified</h4>
        <p className="dark:text-polar-400 mx-auto max-w-sm text-sm text-balance text-gray-600">
          Keep the DNS record in place: Polar checks it again during reviews.
        </p>
      </>
    )
  }

  const domainName = step.value
  if (!domainName) {
    return (
      <Layout description="Add your product website first, then verify its domain.">
        {null}
      </Layout>
    )
  }

  const domain = domains?.items.find((item) => item.domain === domainName)

  const onAdd = async () => {
    const { error } = await createDomain.mutateAsync({ domain: domainName })
    if (error) {
      toast({
        title: 'Failed to add domain',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
    }
  }

  const onVerify = async (domainId: string) => {
    const { error } = await verifyDomain.mutateAsync(domainId)
    if (error) {
      toast({
        title: 'Domain not verified yet',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
    }
  }

  if (!domain) {
    return (
      <Layout
        description={`Prove you own ${domainName} by adding a DNS TXT record.`}
        footerEnd={
          <Button
            size="sm"
            loading={createDomain.isPending}
            disabled={!domains || createDomain.isPending}
            onClick={onAdd}
          >
            Get DNS record
          </Button>
        }
      >
        {null}
      </Layout>
    )
  }

  return (
    <Layout
      description={`Add this TXT record to the DNS of ${domainName}. Keep it in place: Polar checks it again during reviews.`}
      footerEnd={
        <Button
          size="sm"
          loading={verifyDomain.isPending}
          disabled={verifyDomain.isPending}
          onClick={() => onVerify(domain.id)}
        >
          Verify
        </Button>
      }
    >
      <Box flexDirection="column" rowGap="s">
        <Text variant="label">Name</Text>
        <CopyToClipboardInput
          value={domain.verification_record_name}
          onCopy={() => toast({ title: 'Copied to clipboard' })}
          variant="mono"
        />
        <Text variant="label">Value</Text>
        <CopyToClipboardInput
          value={domain.verification_token ?? ''}
          onCopy={() => toast({ title: 'Copied to clipboard' })}
          variant="mono"
        />
      </Box>
    </Layout>
  )
}
