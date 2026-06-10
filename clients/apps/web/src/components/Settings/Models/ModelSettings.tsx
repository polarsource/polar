'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useDeleteLLMProviderConfig,
  useListLLMProviderConfigs,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ListGroup from '@polar-sh/ui/components/atoms/ListGroup'
import { useCallback, useState } from 'react'
import { InlineModal } from '../../Modal/InlineModal'
import { useModal } from '../../Modal/useModal'
import EditModelModal from './EditModelModal'
import NewModelModal from './NewModelModal'

const ModelSettings = ({ org }: { org: schemas['Organization'] }) => {
  const {
    isShown: isNewModalShown,
    show: showNewModal,
    hide: hideNewModal,
  } = useModal()

  const configs = useListLLMProviderConfigs({
    organizationId: org.id,
    limit: 100,
    page: 1,
  })

  return (
    <>
      <ListGroup>
        {configs.data?.items && configs.data.items.length > 0 ? (
          configs.data.items.map((config) => (
            <ListGroup.Item key={config.id}>
              <ConfigRow config={config} />
            </ListGroup.Item>
          ))
        ) : (
          <ListGroup.Item>
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              paddingVertical="xl"
              rowGap="s"
            >
              <Text color="muted">
                {`${org.name} doesn't have any model configurations yet`}
              </Text>
            </Box>
          </ListGroup.Item>
        )}
        <ListGroup.Item>
          <Button asChild onClick={showNewModal}>
            Add Model
          </Button>
        </ListGroup.Item>
      </ListGroup>
      <InlineModal
        isShown={isNewModalShown}
        hide={hideNewModal}
        modalContent={<NewModelModal hide={hideNewModal} organization={org} />}
      />
    </>
  )
}

export default ModelSettings

const ConfigRow = ({ config }: { config: schemas['LLMProviderConfig'] }) => {
  const {
    isShown: isEditModalShown,
    show: showEditModal,
    hide: hideEditModal,
  } = useModal()

  const deleteConfig = useDeleteLLMProviderConfig()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const { error } = await deleteConfig.mutateAsync({ id: config.id })
    if (error) {
      toast({
        title: 'Delete Failed',
        description: `Error deleting model: ${extractApiErrorMessage(error)}`,
      })
      return
    }
    toast({
      title: 'Model Deleted',
      description: 'Model configuration was deleted.',
    })
    setConfirmDelete(false)
  }, [confirmDelete, deleteConfig, config.id])

  const displayLabel = config.display_name || config.model_name

  return (
    <>
      <Box display="flex" alignItems="center" justifyContent="between">
        <Box display="flex" flexDirection="column" rowGap="xs" flex="1">
          <Box display="flex" alignItems="center" columnGap="s">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                config.is_enabled
                  ? 'bg-emerald-500 ring-2 ring-emerald-100'
                  : 'dark:bg-polar-600 bg-gray-300'
              }`}
              title={config.is_enabled ? 'Enabled' : 'Disabled'}
            />
            <Text variant="default" as="span">
              {displayLabel}
            </Text>
          </Box>
          <Box paddingLeft="l">
            <Text variant="caption" color="muted">
              {config.provider} &middot; {config.model_name}
            </Text>
          </Box>
          <Box paddingLeft="l">
            <Text variant="caption" color="muted">
              Added on{' '}
              <FormattedDateTime
                datetime={config.created_at}
                dateStyle="long"
              />
            </Text>
          </Box>
        </Box>
        <Box display="flex" alignItems="center" columnGap="s">
          <Button asChild variant="secondary" onClick={showEditModal}>
            Edit
          </Button>
          <Button
            asChild
            variant={confirmDelete ? 'destructive' : 'ghost'}
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete ? 'Confirm' : 'Delete'}
          </Button>
        </Box>
      </Box>
      <InlineModal
        isShown={isEditModalShown}
        hide={hideEditModal}
        modalContent={<EditModelModal config={config} hide={hideEditModal} />}
      />
    </>
  )
}
