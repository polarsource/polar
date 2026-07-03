'use client'

import { toast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks'
import {
  useDeleteSSOConnection,
  useSSOConnections,
  useUpdateOrganization,
  useUpdateSSOConnection,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getSSOLoginURL } from '@/utils/auth'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal, ListGroup, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { useModal } from '../../Modal/useModal'
import EditSSOConnectionModal from './EditSSOConnectionModal'
import NewSSOConnectionModal from './NewSSOConnectionModal'

const SSOSettings = ({ org }: { org: schemas['Organization'] }) => {
  const { isShown, show, hide } = useModal()
  const { currentUser } = useAuth()
  const connections = useSSOConnections(org.id)
  const updateOrganization = useUpdateOrganization()

  const hasEnabledConnection = connections.data?.items?.some(
    (connection) => connection.enabled,
  )
  // Enforcing is only allowed from a session already authenticated through
  // this organization's SSO — a scoped session can only reach this org, so
  // `organization_scoped` here means "signed in via this org's SSO".
  const canEnforce = currentUser?.organization_scoped ?? false

  const toggleEnforced = async () => {
    const { error } = await updateOrganization.mutateAsync({
      id: org.id,
      body: { sso_enforced: !org.sso_enforced },
    })
    if (error) {
      toast({
        title: 'Update failed',
        description: extractApiErrorMessage(error),
      })
    }
  }

  return (
    <>
      <Box flexDirection="column" gap="l">
        <Box flexDirection="column" gap="xs">
          <Text variant="label">Login link</Text>
          <CopyToClipboardInput
            value={getSSOLoginURL(org.slug)}
            variant="mono"
            onCopy={() => toast({ title: 'Copied to clipboard' })}
          />
          <Text variant="caption" color="muted">
            Share this link with your members to sign in via SSO.
          </Text>
        </Box>
        <ListGroup>
          {connections.data?.items && connections.data.items.length > 0 ? (
            connections.data.items.map((connection) => (
              <ListGroup.Item key={connection.id}>
                <SSOConnectionRow org={org} connection={connection} />
              </ListGroup.Item>
            ))
          ) : (
            <ListGroup.Item>
              <Text color="muted">
                {`${org.name} doesn't have any SSO connections yet`}
              </Text>
            </ListGroup.Item>
          )}
          <ListGroup.Item>
            <Button onClick={show}>Add connection</Button>
          </ListGroup.Item>
        </ListGroup>
        <Box alignItems="center" justifyContent="between" width="100%">
          <Box flexDirection="column" gap="xs">
            <Box alignItems="center" gap="s">
              <Text variant="label">Enforce SSO</Text>
              <Status
                status={org.sso_enforced ? 'Enforced' : 'Not enforced'}
                color={org.sso_enforced ? 'green' : 'gray'}
                size="small"
              />
            </Box>
            <Text variant="caption" color="muted">
              {org.sso_enforced
                ? 'Members must sign in through SSO to access this organization.'
                : !hasEnabledConnection
                  ? 'Add and enable an SSO connection before enforcing SSO.'
                  : !canEnforce
                    ? 'Sign in through this organization’s SSO to enforce it.'
                    : 'Require members to sign in through SSO to access this organization.'}
            </Text>
          </Box>
          <Button
            variant="secondary"
            onClick={toggleEnforced}
            loading={updateOrganization.isPending}
            disabled={
              !org.sso_enforced && (!canEnforce || !hasEnabledConnection)
            }
          >
            {org.sso_enforced ? 'Stop enforcing' : 'Enforce'}
          </Button>
        </Box>
      </Box>
      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={<NewSSOConnectionModal organization={org} hide={hide} />}
      />
    </>
  )
}

export default SSOSettings

const SSOConnectionRow = ({
  org,
  connection,
}: {
  org: schemas['Organization']
  connection: schemas['OrganizationSSOConnection']
}) => {
  const { isShown, show, hide } = useModal()
  const updateConnection = useUpdateSSOConnection(org.id, connection.id)
  const deleteConnection = useDeleteSSOConnection(org.id)

  const toggleEnabled = async () => {
    const { error } = await updateConnection.mutateAsync({
      enabled: !connection.enabled,
    })
    if (error) {
      toast({
        title: 'Update failed',
        description: extractApiErrorMessage(error),
      })
    }
  }

  const onDelete = async () => {
    if (
      !window.confirm(
        'Delete this SSO connection? Members will no longer be able to sign in with it.',
      )
    ) {
      return
    }
    const { error } = await deleteConnection.mutateAsync(connection.id)
    if (error) {
      toast({
        title: 'Deletion failed',
        description: extractApiErrorMessage(error),
      })
    }
  }

  return (
    <>
      <Box alignItems="center" justifyContent="between" width="100%">
        <Box flexDirection="column" gap="xs">
          <Box alignItems="center" gap="s">
            <Text>{connection.name ?? connection.configuration.issuer}</Text>
            <Status
              status={connection.enabled ? 'Enabled' : 'Disabled'}
              color={connection.enabled ? 'green' : 'gray'}
              size="small"
            />
          </Box>
          <Text variant="caption" color="muted">
            {connection.configuration.issuer}
          </Text>
        </Box>
        <Box alignItems="center" gap="s">
          <Button variant="secondary" onClick={show}>
            Edit
          </Button>
          <Button
            variant="secondary"
            onClick={toggleEnabled}
            loading={updateConnection.isPending}
          >
            {connection.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button
            variant="ghost"
            onClick={onDelete}
            loading={deleteConnection.isPending}
          >
            Delete
          </Button>
        </Box>
      </Box>
      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={
          <EditSSOConnectionModal
            organization={org}
            connection={connection}
            hide={hide}
          />
        }
      />
    </>
  )
}
