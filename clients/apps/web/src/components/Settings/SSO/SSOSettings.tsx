'use client'

import { toast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks'
import {
  useOrganizationDomains,
  useSSOConnections,
  useUpdateOrganization,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getSSOLoginURL } from '@/utils/auth'
import { schemas } from '@polar-sh/client'
import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from '../../Modal/ConfirmModal'
import { useModal } from '../../Modal/useModal'
import {
  SettingsGroup,
  SettingsGroupItem,
  SettingsGroupRow,
} from '../SettingsGroup'
import { SSOConnectionRow } from './SSOConnectionRow'
import SSODomains, { isVerifiedDomain } from './SSODomains'

const SSOSettings = ({
  org,
  onAddConnection,
}: {
  org: schemas['Organization']
  onAddConnection: () => void
}) => {
  const {
    isShown: enforceModalShown,
    show: showEnforceModal,
    hide: hideEnforceModal,
  } = useModal()
  const { currentUser } = useAuth()
  const router = useRouter()
  const connections = useSSOConnections(org.id)
  const domains = useOrganizationDomains(org.id)
  const verifiedDomains = (domains.data?.items ?? []).filter(isVerifiedDomain)
  const updateOrganization = useUpdateOrganization()

  const isAutomatic = org.sso_enforced && verifiedDomains.length > 0
  const hasEnabledConnection = connections.data?.items?.some(
    (connection) => connection.enabled,
  )
  // Enforcing is only allowed from a session already authenticated through
  // this organization's SSO — a scoped session can only reach this org, so
  // `organization_scoped` here means "signed in via this org's SSO".
  const canEnforce = currentUser?.organization_scoped ?? false

  const applyEnforced = async (sso_enforced: boolean) => {
    const { error } = await updateOrganization.mutateAsync({
      id: org.id,
      body: { sso_enforced },
    })
    if (error) {
      toast({
        title: 'Update failed',
        description: extractApiErrorMessage(error),
      })
      return
    }
    // Refresh the router to get the updated organization data from the server
    router.refresh()
  }

  return (
    <>
      <Box flexDirection="column" rowGap="2xl">
        <SettingsGroup title="Connections">
          {connections.data?.items && connections.data.items.length > 0 ? (
            connections.data.items.map((connection) => (
              <SettingsGroupRow key={connection.id}>
                <SSOConnectionRow org={org} connection={connection} />
              </SettingsGroupRow>
            ))
          ) : (
            <Box
              flexDirection="column"
              alignItems="center"
              rowGap="l"
              paddingVertical="3xl"
              paddingHorizontal="xl"
            >
              <Box flexDirection="column" alignItems="center" rowGap="xs">
                <Text variant="title">No SSO connections</Text>
                <Text color="muted" align="center">
                  Connect your identity provider to let members sign in with
                  SSO.
                </Text>
              </Box>
              <Button variant="secondary" onClick={onAddConnection}>
                Add connection
              </Button>
            </Box>
          )}
        </SettingsGroup>
        {!isAutomatic && (
          <SettingsGroup title="Login link">
            <SettingsGroupItem
              layout="stacked"
              title="SSO login URL"
              description="Share this link with your members to sign in via SSO."
            >
              <CopyToClipboardInput
                value={getSSOLoginURL(org.slug)}
                variant="mono"
                onCopy={() => toast({ title: 'Copied to clipboard' })}
              />
            </SettingsGroupItem>
          </SettingsGroup>
        )}
        <SettingsGroup title="Enforcement">
          <SettingsGroupItem
            layout="inline"
            title="Enforce SSO"
            description={
              org.sso_enforced
                ? 'Members must sign in through SSO to access this organization.'
                : !hasEnabledConnection
                  ? 'Add and enable an SSO connection before enforcing SSO.'
                  : !canEnforce
                    ? 'Sign in through this organization’s SSO to enforce it.'
                    : 'Require members to sign in through SSO to access this organization.'
            }
          >
            <Box alignItems="center" columnGap="m">
              <Status
                status={org.sso_enforced ? 'Enforced' : 'Not enforced'}
                color={org.sso_enforced ? 'green' : 'gray'}
                size="small"
              />
              <Button
                variant="secondary"
                onClick={() =>
                  org.sso_enforced ? applyEnforced(false) : showEnforceModal()
                }
                loading={updateOrganization.isPending}
                disabled={
                  !org.sso_enforced && (!canEnforce || !hasEnabledConnection)
                }
              >
                {org.sso_enforced ? 'Stop enforcing' : 'Enforce'}
              </Button>
            </Box>
          </SettingsGroupItem>
          {org.sso_enforced && domains.data && (
            <SettingsGroupItem
              layout="stacked"
              title="Domains"
              description={
                verifiedDomains.length === 0 ? (
                  <>
                    <Link
                      href={`/dashboard/${org.slug}/settings/domains`}
                      className="underline"
                    >
                      Verify your email domain
                    </Link>{' '}
                    so members signing in with it go straight to SSO.
                  </>
                ) : undefined
              }
            >
              {verifiedDomains.length > 0 && (
                <SSODomains domains={verifiedDomains} />
              )}
            </SettingsGroupItem>
          )}
        </SettingsGroup>
      </Box>
      <ConfirmModal
        isShown={enforceModalShown}
        hide={hideEnforceModal}
        onConfirm={() => applyEnforced(true)}
        title="Enforce SSO"
        description="All members and authorized third-party apps will be disconnected and must be re-authorized through SSO."
        destructive
        destructiveText="Enforce"
        confirmPrompt={org.slug}
      />
    </>
  )
}

export default SSOSettings
