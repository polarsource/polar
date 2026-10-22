import { StaticImage } from '@/components/Image/StaticImage'
import type { PropsWithChildren, ReactNode } from 'react'
import { WindowFrame } from '../story/Frame'

export type BackdropSrc = string

interface ImageBandProps {
  src: BackdropSrc
  focus?: string
  sizes?: string
  className?: string
}

/** A rounded photo panel, dimmed like the landing figures, with its children centered on top. */
export const ImageBand = ({
  src,
  focus = 'center',
  sizes = '100vw',
  className = '',
  children,
}: PropsWithChildren<ImageBandProps>) => (
  <div
    className={`dark:border-polar-800 relative flex w-full min-w-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 p-4 md:p-12 ${className}`}
  >
    <StaticImage
      src={src}
      alt=""
      fill
      sizes={sizes}
      className="object-cover"
      style={{ objectPosition: focus }}
    />
    <div className="pointer-events-none absolute inset-0 bg-black/40" />
    {children}
  </div>
)

/** The lighter sheet inside a window frame. */
export const FrameSheet = ({ children }: PropsWithChildren) => (
  <div className="dark:bg-polar-900 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white p-6">
    {children}
  </div>
)

interface BackdropPanelProps {
  src: BackdropSrc
  focus?: string
  aside?: ReactNode
}

/** A photo panel holding one window that fills it, for figures that set their own height. */
export const BackdropPanel = ({
  src,
  focus,
  aside,
  children,
}: PropsWithChildren<BackdropPanelProps>) => (
  <ImageBand
    src={src}
    focus={focus}
    sizes="(min-width: 1024px) 50vw, 100vw"
    className="aspect-[4/3]"
  >
    <WindowFrame aside={aside} className="h-full">
      <FrameSheet>{children}</FrameSheet>
    </WindowFrame>
  </ImageBand>
)
