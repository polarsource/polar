import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import Image from 'next/image'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export const ImageOverlay = (props: ComponentProps<'img'>) => {
  const { isShown, hide, show } = useModal()

  if (!props.src) {
    return <></>
  }

  // Optimize images if they are served from the Polar Vercel Blob Bucket
  if (
    props.src.startsWith(
      'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/',
    )
  ) {
    return (
      <>
        <Image
          src={props.src}
          alt={props.alt ?? ''}
          className={twMerge(props.className, 'cursor-pointer')}
          onClick={show}
          width={672}
          height={100}
          quality={90}
        />
        <Modal
          modalContent={
            <img
              src={props.src}
              alt={props.alt ?? ''}
              className={twMerge(props.className, 'w-full max-w-screen-xl')}
            />
          }
          isShown={isShown}
          hide={hide}
        />
      </>
    )
  }

  // Fallback to plain <img>
  return (
    <>
      <img
        src={props.src}
        alt={props.alt ?? ''}
        className={twMerge(props.className, 'cursor-pointer')}
        onClick={show}
        width={672}
      />
      <Modal
        modalContent={
          <img
            src={props.src}
            alt={props.alt ?? ''}
            className={twMerge(props.className, 'w-full max-w-screen-xl')}
            width={672}
          />
        }
        isShown={isShown}
        hide={hide}
      />
    </>
  )
}
