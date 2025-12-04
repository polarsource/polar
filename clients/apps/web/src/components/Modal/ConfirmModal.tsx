import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { MouseEvent, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Modal, ModalProps } from '.'

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
  const prompt = watch('prompt')

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
        <>
          <div className="flex flex-col gap-y-4 p-8">
            <>
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
                  onSubmit={handleSubmit(onSubmit)}
                >
                  {confirmPrompt && (
                    <>
                      <p className="dark:text-polar-400 max-w-full text-sm text-gray-500">
                        Please enter &quot;{confirmPrompt}&quot; to confirm:
                      </p>
                      <FormField
                        control={control}
                        name="prompt"
                        rules={{
                          validate: (value) =>
                            value === confirmPrompt ||
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
                                    placeholder={confirmPrompt}
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
                        confirmPrompt ? prompt !== confirmPrompt : false
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
            </>
          </div>
        </>
      }
    />
  )
}
