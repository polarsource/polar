import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export const ImageOverlay = (props: ComponentProps<'img'>) => {
  const { isShown, hide, show } = useModal()

  return (
    <>
      <img
        {...props}
        className={twMerge(props.className, 'cursor-pointer')}
        onClick={show}
      />
      <Modal
        modalContent={
          <img
            {...props}
            className={twMerge(props.className, 'w-full max-w-screen-xl')}
            onClick={show}
          />
        }
        isShown={isShown}
        hide={hide}
      />
    </>
  )
}
