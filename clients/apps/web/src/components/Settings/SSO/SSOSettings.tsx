'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useDeleteSSOConnection,
  useSSOConnections,
  useUpdateSSOConnection,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getSSOLoginURL } from '@/utils/auth'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal, ListGroup, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { useModal } from '../../Modal/useModal'
import NewSSOConnectionModal from './NewSSOConnectionModal'

const SSOSettings = ({ org }: { org: schemas['Organization'] }) => {
  const { isShown, show, hide } = useModal()
  const connections = useSSOConnections(org.id)

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
    <Box alignItems="center" justifyContent="between" width="100%">
      <Box flexDirection="column" gap="xs">
        <Box alignItems="center" gap="s">
          <Text>{connection.configuration.issuer}</Text>
          <Status
            status={connection.enabled ? 'Enabled' : 'Disabled'}
            color={connection.enabled ? 'green' : 'gray'}
            size="small"
          />
        </Box>
      </Box>
      <Box alignItems="center" gap="s">
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
  )
}
