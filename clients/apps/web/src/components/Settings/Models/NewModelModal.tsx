'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import { useCreateLLMProviderConfig } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import {
  FieldApiKey,
  FieldDisplayName,
  FieldModelName,
  FieldProvider,
} from './ModelForm'

export default function NewModelModal({
  organization,
  hide,
}: {
  organization: schemas['Organization']
  hide: () => void
}) {
  const form = useForm<schemas['LLMProviderConfigCreate']>({
    defaultValues: {
      organization_id: organization.id,
    },
  })

  const { handleSubmit } = form

  const createConfig = useCreateLLMProviderConfig()

  const onSubmit = useCallback(
    async (data: schemas['LLMProviderConfigCreate']) => {
      const { error } = await createConfig.mutateAsync(data)
      if (error) {
        toast({
          title: 'Model Creation Failed',
          description: `Error creating model: ${extractApiErrorMessage(error)}`,
        })
        return
      }
      toast({
        title: 'Model Created',
        description: 'Model configuration was created successfully.',
      })
      hide()
    },
    [createConfig, hide],
  )

  return (
    <>
      <InlineModalHeader hide={hide}>
        <h2 className="text-xl">Add Model</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-w-[700px] space-y-8"
          >
            <FieldProvider />
            <FieldModelName />
            <FieldDisplayName />
            <FieldApiKey />

            <Button
              type="submit"
              loading={createConfig.isPending}
              disabled={createConfig.isPending}
            >
              Create
            </Button>
          </form>
        </Form>
      </div>
    </>
  )
}
