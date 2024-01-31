import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import Image from 'next/image'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

const numOrDefault = (
  n: number | string | undefined,
  _default: number,
): number => {
  if (typeof n === 'number') {
    return n
  }
  if (typeof n === 'string' && parseInt(n) > 0) {
    return parseInt(n)
  }
  return _default
}

export const ImageOverlay = (props: ComponentProps<'img'>) => {
  const { isShown, hide, show } = useModal()

  if (!props.src) {
    return <></>
  }

  const width = numOrDefault(props.width, 672)
  const height = numOrDefault(props.height, 100)

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
          width={width}
          height={height}
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
        width={width}
        height={height}
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
