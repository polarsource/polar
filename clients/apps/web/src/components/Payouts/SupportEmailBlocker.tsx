import { SupportEmailVerifyFlow } from '@/components/Finance/Account/sections/SupportEmailVerifyFlow'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

interface Props {
  organization: schemas['Organization']
  email: string | null
  hide: () => void
}

export const SupportEmailBlocker = ({ organization, email, hide }: Props) => {
  const settingsUrl = `/dashboard/${organization.slug}/settings`
  return (
    <Box flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="s">
        <h1 className="text-2xl">Verify your support email</h1>
        <Box color="text-secondary">
          <p>Payouts need a verified support email.</p>
        </Box>
      </Box>
      {email ? (
        <SupportEmailVerifyFlow
          organization={organization}
          updateEmailHref={settingsUrl}
        />
      ) : (
        <>
          <Box color="text-secondary">
            <p>
              Add one in your organization settings, then come back to withdraw.
            </p>
          </Box>
          <Box columnGap="m">
            <Link href={settingsUrl}>
              <Button variant="default">Open settings</Button>
            </Link>
            <Button variant="ghost" onClick={hide}>
              Close
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}
