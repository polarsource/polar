import { Button } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { MouseEvent, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Modal, type ModalProps } from '@polar-sh/orbit'

// Collapses runs of any Unicode whitespace (including non-breaking spaces,
// common in labels pasted from design tools) into a single regular space, so
// the confirmation text stays typeable on a regular keyboard.
const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/gu, ' ').trim()

export interface ConfirmModalProps extends Omit<
  ModalProps,
  'title' | 'modalContent'
> {
  title: string
  description?: string
  body?: React.ReactNode
  destructive?: boolean
  destructiveText?: string
  confirmPrompt?: string
  onConfirm: () => void
  onCancel?: () => void
}

export const ConfirmModal = ({
  title,
  description,
  body,
  destructive,
  destructiveText = 'Delete',
  confirmPrompt = undefined,
  onConfirm,
  onCancel,
  ...props
}: ConfirmModalProps) => {
  const form = useForm<{ prompt?: string }>({
    defaultValues: {
      prompt: '',
    },
  })
  const { control, handleSubmit, reset, watch } = form
  // eslint-disable-next-line react-hooks/incompatible-library
  const prompt = watch('prompt')
  const normalizedConfirmPrompt =
    confirmPrompt !== undefined ? normalizeWhitespace(confirmPrompt) : undefined

  const handleConfirm = useCallback(() => {
    onConfirm()
    reset()
    props.hide()
  }, [onConfirm, props, reset])

  const handleCancel = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      reset()
      onCancel?.()
      props.hide()
    },
    [onCancel, props, reset],
  )

  const onSubmit = async () => {
    handleConfirm()
  }

  return (
    <Modal
      title={title}
      className="md:min-w-[300px] lg:max-w-[600px]"
      {...props}
      modalContent={
        <div className="flex flex-col gap-y-4 p-8">
          <h3 className="text-xl font-medium">{title}</h3>
          {description && (
            <p className="dark:text-polar-400 max-w-full text-sm text-gray-500">
              {description}
            </p>
          )}
          {body}
          <Form {...form}>
            <form
              className="flex w-full flex-col gap-y-2"
              onSubmit={(e) => {
                e.stopPropagation()
                handleSubmit(onSubmit)(e)
              }}
            >
              {confirmPrompt && (
                <>
                  <p className="dark:text-polar-400 max-w-full text-sm text-gray-500">
                    Please enter &quot;{normalizedConfirmPrompt}&quot; to
                    confirm:
                  </p>
                  <FormField
                    control={control}
                    name="prompt"
                    rules={{
                      validate: (value) =>
                        normalizeWhitespace(value ?? '') ===
                          normalizedConfirmPrompt ||
                        'Please enter the exact text to confirm',
                    }}
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormControl className="w-full">
                            <div className="flex w-full flex-row gap-2">
                              <Input
                                type="input"
                                required
                                placeholder={normalizedConfirmPrompt}
                                autoComplete="off"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                </>
              )}
              <div className="flex flex-row-reverse gap-x-4 pt-2">
                <Button
                  type="submit"
                  variant={destructive ? 'destructive' : 'default'}
                  disabled={
                    normalizedConfirmPrompt
                      ? normalizeWhitespace(prompt ?? '') !==
                        normalizedConfirmPrompt
                      : false
                  }
                >
                  {destructive ? destructiveText : 'Confirm'}
                </Button>
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>
      }
    />
  )
}
