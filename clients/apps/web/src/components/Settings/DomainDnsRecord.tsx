import { toast } from '@/components/Toast/use-toast'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'

export const DomainDnsRecord = ({
  domain,
}: {
  domain: schemas['OrganizationDomain']
}) => (
  <Box flexDirection="column" rowGap="s">
    <Text variant="label">Name</Text>
    <CopyToClipboardInput
      value={domain.verification_record_name}
      ariaLabel="TXT record name"
      onCopy={() => toast({ title: 'Copied to clipboard' })}
      variant="mono"
    />
    <Text variant="label">Value</Text>
    <CopyToClipboardInput
      value={domain.verification_token ?? ''}
      ariaLabel="TXT record value"
      onCopy={() => toast({ title: 'Copied to clipboard' })}
      variant="mono"
    />
  </Box>
)
