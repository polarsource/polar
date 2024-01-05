import { Button } from 'polarkit/components/ui/atoms'
import { useCallback } from 'react'
import { Modal, ModalProps } from '../Modal'

export interface ConfirmModalProps extends Omit<ModalProps, 'modalContent'> {
  title: string
  description: string
  destructive?: boolean
  destructiveText?: string
  onConfirm: () => void
  onCancel?: () => void
}

export const ConfirmModal = ({
  title,
  description,
  destructive,
  destructiveText = 'Delete',
  onConfirm,
  onCancel,
  ...props
}: ConfirmModalProps) => {
  const handleConfirm = useCallback(() => {
    onConfirm()
    props.hide()
  }, [onConfirm, props])

  const handleCancel = useCallback(() => {
    onCancel?.()
    props.hide()
  }, [onCancel, props])

  return (
    <Modal
      className="md:min-w-[600px]"
      {...props}
      modalContent={
        <>
          <div className="flex flex-col items-center gap-y-6 px-6 py-12 text-center">
            <>
              <h3 className="text-xl font-medium">{title}</h3>
              <p className="dark:text-polar-400 max-w-full text-sm leading-relaxed text-gray-500 md:max-w-[480px]">
                {description}
              </p>
              <div className="flex flex-row items-center justify-center gap-x-4 pt-6">
                <Button
                  variant={destructive ? 'destructive' : 'default'}
                  onClick={handleConfirm}
                >
                  {destructive ? destructiveText : 'Confirm'}
                </Button>
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </>
          </div>
        </>
      }
    />
  )
}
