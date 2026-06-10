'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateLLMProviderConfig } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { FieldApiKey, FieldDisplayName, FieldEnabled } from './ModelForm'

export default function EditModelModal({
  config,
  hide,
}: {
  config: schemas['LLMProviderConfig']
  hide: () => void
}) {
  const form = useForm<schemas['LLMProviderConfigUpdate']>({
    defaultValues: {
      display_name: config.display_name,
      is_enabled: config.is_enabled,
    },
  })

  const { handleSubmit } = form

  const updateConfig = useUpdateLLMProviderConfig()

  const onSubmit = useCallback(
    async (data: schemas['LLMProviderConfigUpdate']) => {
      const body: schemas['LLMProviderConfigUpdate'] = {
        display_name: data.display_name,
        is_enabled: data.is_enabled,
      }
      if (data.api_key) {
        body.api_key = data.api_key
      }
      const { error } = await updateConfig.mutateAsync({
        id: config.id,
        body,
      })
      if (error) {
        toast({
          title: 'Update Failed',
          description: `Error updating model: ${extractApiErrorMessage(error)}`,
        })
        return
      }
      toast({
        title: 'Model Updated',
        description: 'Model configuration was updated successfully.',
      })
      hide()
    },
    [updateConfig, config.id, hide],
  )

  return (
    <>
      <InlineModalHeader hide={hide}>
        <h2 className="text-xl">
          Edit {config.display_name || config.model_name}
        </h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-w-[700px] space-y-8"
          >
            <FieldDisplayName />
            <FieldApiKey placeholder="Leave blank to keep current key" />
            <FieldEnabled />

            <Button
              type="submit"
              loading={updateConfig.isPending}
              disabled={updateConfig.isPending}
            >
              Save
            </Button>
          </form>
        </Form>
      </div>
    </>
  )
}
