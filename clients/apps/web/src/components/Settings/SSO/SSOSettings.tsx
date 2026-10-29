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
import { Alert, Button, Status } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { LogIn } from '@polar-sh/orbit/icons'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from '../../Modal/ConfirmModal'
import { useModal } from '../../Modal/useModal'
import {
  SettingsGroup,
  SettingsGroupItem,
  SettingsGroupRow,
  SettingsSection,
} from '../SettingsGroup'
import { EmptyState } from '../../Shared/EmptyState'
import { SSOConnectionRow } from './SSOConnectionRow'
import SSODomains, { isVerifiedDomain } from './SSODomains'

const SSOSettings = ({ org }: { org: schemas['Organization'] }) => {
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

  const hasVerifiedDomain = verifiedDomains.length > 0
  const isAutomatic = org.sso_enforced && hasVerifiedDomain
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
        {domains.data && !hasVerifiedDomain && (
          <Alert
            variant="info"
            title="Verify your email domain"
            description={
              <>
                SSO only works for a domain you own.{' '}
                <Link
                  href={`/dashboard/${org.slug}/settings/domains`}
                  className="underline"
                >
                  Add and verify it
                </Link>{' '}
                before adding a connection.
              </>
            }
          />
        )}
        {connections.data?.items && connections.data.items.length > 0 ? (
          <SettingsGroup title="Connections">
            {connections.data.items.map((connection) => (
              <SettingsGroupRow key={connection.id}>
                <SSOConnectionRow org={org} connection={connection} />
              </SettingsGroupRow>
            ))}
          </SettingsGroup>
        ) : (
          <SettingsSection title="Connections">
            <EmptyState
              icon={<LogIn />}
              title="No SSO connections"
              description="Add a connection so members can sign in with your identity provider."
            />
          </SettingsSection>
        )}
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
                  : !hasVerifiedDomain
                    ? 'Verify your email domain before enforcing SSO.'
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
                  !org.sso_enforced &&
                  (!canEnforce || !hasEnabledConnection || !hasVerifiedDomain)
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
