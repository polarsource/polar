'use client'

import { toast } from '@/components/Toast/use-toast'
import { useDeleteSSOConnection, useUpdateSSOConnection } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { EllipsisVertical } from '@polar-sh/orbit/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { ConfirmModal } from '../../Modal/ConfirmModal'
import { useModal } from '../../Modal/useModal'
import EditSSOConnectionModal from './EditSSOConnectionModal'

export const SSOConnectionRow = ({
  org,
  connection,
}: {
  org: schemas['Organization']
  connection: schemas['OrganizationSSOConnection']
}) => {
  const { isShown, show, hide } = useModal()
  const {
    isShown: deleteModalShown,
    show: showDeleteModal,
    hide: hideDeleteModal,
  } = useModal()
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
            <Text variant="title">
              {connection.name ?? connection.configuration.issuer}
            </Text>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Connection actions"
              loading={updateConnection.isPending || deleteConnection.isPending}
            >
              <EllipsisVertical size={16} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={show}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={toggleEnabled}>
              {connection.enabled ? 'Disable' : 'Enable'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={showDeleteModal}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Box>
      <ConfirmModal
        isShown={deleteModalShown}
        hide={hideDeleteModal}
        onConfirm={onDelete}
        title="Delete SSO connection"
        description="Members will no longer be able to sign in with this connection."
        destructive
      />
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
