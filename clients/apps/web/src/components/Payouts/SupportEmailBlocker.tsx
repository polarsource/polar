import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

interface Props {
  organization: schemas['Organization']
  email: string | null
  hide: () => void
}

export const SupportEmailBlocker = ({ organization, email, hide }: Props) => (
  <Box flexDirection="column" rowGap="l">
    <Text>
      Payouts need a verified support email.{' '}
      {email
        ? `Verify ${email} from your organization settings, then come back to withdraw.`
        : 'Add one in your organization settings and verify it, then come back to withdraw.'}
    </Text>
    <Box columnGap="m">
      <Link href={`/dashboard/${organization.slug}/settings`}>
        <Button variant="default">Verify support email</Button>
      </Link>
      <Button variant="ghost" onClick={hide}>
        Close
      </Button>
    </Box>
  </Box>
)
