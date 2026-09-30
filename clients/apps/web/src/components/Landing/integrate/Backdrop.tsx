import { StaticImage } from '@/components/Image/StaticImage'
import { Box } from '@polar-sh/orbit/Box'
import type { PropsWithChildren } from 'react'

export type BackdropSrc = string

interface BackdropPanelProps {
  src: BackdropSrc
  focus?: string
  aspectRatio?: string
}

/**
 * A photo-filled panel with an opaque card on top: cover-fit image, then the
 * children inside a background-primary surface that fills the padded area.
 */
export const BackdropPanel = ({
  src,
  focus = 'center',
  aspectRatio,
  children,
}: PropsWithChildren<BackdropPanelProps>) => (
  <Box
    position="relative"
    overflow="hidden"
    minWidth={0}
    aspectRatio={aspectRatio}
    padding={{ base: 'xl', md: '2xl' }}
    backgroundColor="background-secondary"
  >
    <StaticImage
      src={src}
      alt=""
      fill
      sizes="(min-width: 1024px) 50vw, 100vw"
      className="object-cover"
      style={{ objectPosition: focus }}
    />
    <Box
      position="relative"
      width="100%"
      height="100%"
      minWidth={0}
      flexDirection="column"
      padding={{ base: 'xl', md: '2xl' }}
      backgroundColor="background-primary"
    >
      {children}
    </Box>
  </Box>
)
