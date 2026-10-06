import { Text } from '@polar-sh/orbit'
import { StaticImage } from '@/components/Image/StaticImage'
import { Box } from '@polar-sh/orbit/Box'
import type { CSSProperties, PropsWithChildren } from 'react'
import LogoType from '../logos/LogoType'

export type PosterSurface = 'night' | 'snow' | 'ether'

interface Surface {
  background: string
  ink: string
  dim: string
}

/** The accent, for the rare word that should carry it on a Night or Snow sheet. */
export const ETHER = '#3619CC'

const SURFACES: Record<PosterSurface, Surface> = {
  night: { background: '#090909', ink: '#d8d8d8', dim: 'rgb(60, 60, 60)' },
  snow: { background: '#d8d8d8', ink: '#090909', dim: 'rgb(170, 170, 170)' },
  ether: {
    background: ETHER,
    ink: '#d8d8d8',
    dim: 'rgba(216, 216, 216, 0.3)',
  },
}

export const POSTER_WIDTH = 400
export const POSTER_HEIGHT = 500

/**
 * A fixed-palette sheet. Posters are artifacts, so they keep their own
 * surface and ink regardless of the page theme; children inherit the ink
 * through `currentColor`, and the landing graphics pick it up through the
 * `--color-graphic-*` variables they read from their canvas. A signed sheet
 * carries the wordmark in its upper-left corner, so a signed sheet's first
 * row keeps its left side clear (see `PosterHeader`); a sheet with a backdrop sits
 * inset on a photo so the photo shows only around its edges.
 */
const PosterMark = () => (
  <Box
    position="absolute"
    left={{ base: 'xl', md: '2xl' }}
    top={{ base: 'xl', md: '2xl' }}
  >
    <LogoType height={17} />
  </Box>
)

interface PosterFrameProps {
  surface: PosterSurface
  /** Sign the sheet with the wordmark in the upper-left corner. */
  signed?: boolean
  /** A photo behind the sheet, showing only as a thin border around it. */
  backdrop?: string
}

export const PosterFrame = ({
  surface,
  signed,
  backdrop,
  children,
}: PropsWithChildren<PosterFrameProps>) => {
  const { background, ink, dim } = SURFACES[surface]
  const style = {
    background,
    color: ink,
    '--poster-surface': background,
    '--color-graphic-stroke': ink,
    '--color-graphic-dim': dim,
  } as CSSProperties

  return (
    <Box
      display="block"
      width="100%"
      aspectRatio={`${POSTER_WIDTH} / ${POSTER_HEIGHT}`}
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <div className="relative h-full w-full overflow-hidden">
        {backdrop ? (
          <StaticImage
            src={backdrop}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="object-cover"
          />
        ) : null}
        <div
          className={
            backdrop
              ? 'absolute inset-4 overflow-hidden md:inset-5'
              : 'relative h-full w-full overflow-hidden'
          }
          style={style}
        >
          {children}
          {signed ? <PosterMark /> : null}
        </div>
      </div>
    </Box>
  )
}

/** Full-bleed static drawing layer; the viewBox matches the sheet's aspect. */
export const PosterCanvas = ({ children }: PropsWithChildren) => (
  <svg
    className="absolute inset-0 h-full w-full"
    viewBox={`0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={1}
    aria-hidden
  >
    {children}
  </svg>
)

/** The sheet's padded content area: a column pinned to all four edges. */
export const PosterBody = ({
  justifyContent = 'between',
  children,
}: PropsWithChildren<{ justifyContent?: 'between' | 'center' | 'end' }>) => (
  <Box
    position="absolute"
    inset="none"
    flexDirection="column"
    justifyContent={justifyContent}
    padding={{ base: 'xl', md: '2xl' }}
  >
    {children}
  </Box>
)

/** Mono metadata in the sheet's ink. */
export const PosterMono = ({
  dim,
  children,
}: PropsWithChildren<{ dim?: boolean }>) => (
  <Text variant="caption" as="span" color="inherit" monospace>
    {dim ? (
      <Box as="span" opacity={0.5}>
        {children}
      </Box>
    ) : (
      children
    )}
  </Text>
)

/** A two-tone headline: the statement, then its quieter second half. */
export const PosterHeadline = ({
  primary,
  secondary,
  size = 'heading-s',
}: {
  primary: string
  secondary?: string
  size?: 'heading-xxs' | 'heading-xs' | 'heading-s'
}) => (
  <Box flexDirection="column">
    <Text variant={size} as="p" color="inherit" wrap="balance" leading="tight">
      {primary}
    </Text>
    {secondary ? (
      <Text
        variant={size}
        as="p"
        color="inherit"
        wrap="balance"
        leading="tight"
      >
        <Box as="span" opacity={0.5}>
          {secondary}
        </Box>
      </Text>
    ) : null}
  </Box>
)

/** A hairline in the sheet's ink, independent of the page theme. */
export const PosterRule = () => (
  <svg width="100%" height={1} aria-hidden>
    <line
      x1={0}
      y1={0.5}
      x2="100%"
      y2={0.5}
      stroke="currentColor"
      opacity={0.4}
    />
  </svg>
)

/**
 * The first row of a signed sheet: the wordmark owns the left, so this only
 * places a mono label on the right, at the wordmark's height.
 */
export const PosterHeader = ({ children }: PropsWithChildren) => (
  <Box
    width="100%"
    justifyContent="end"
    alignItems="center"
    minHeight={17}
    paddingBottom="xl"
  >
    {children ? <PosterMono dim>{children}</PosterMono> : null}
  </Box>
)
