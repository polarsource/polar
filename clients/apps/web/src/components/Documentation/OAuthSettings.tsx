'use client'

import { useAuth } from '@/hooks'
import { useLoginLink } from '@/hooks/login'
import Link from 'next/link'
import { ShadowListGroup } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import OAuthSettingsBase from '../Settings/OAuth/OAuthSettings'
import { usePostHog } from '@/hooks/posthog'

const OAuthSettings = () => {
  const posthog = usePostHog()
  const { currentUser } = useAuth()
  const loginLink = useLoginLink()

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
  }

  if (!currentUser) {
    return (
      <ShadowListGroup>
        <div className="flex flex-col items-center gap-4 p-4">
          <div>You must be logged in to manage your OAuth clients.</div>
          <Link href={loginLink} onClick={onLoginClick}>
            <Button type="button">Log in</Button>
          </Link>
        </div>
      </ShadowListGroup>
    )
  }

  return <OAuthSettingsBase />
}

export default OAuthSettings
