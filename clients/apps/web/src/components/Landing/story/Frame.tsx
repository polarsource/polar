import LogoType from '@/components/Brand/logos/LogoType'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode, Ref } from 'react'

/** A sheet inside a figure window: a body-size title, an optional aside, and its content filling the height. */
export const Sheet = ({
  title,
  subtitle,
  aside,
  children,
  large = false,
}: {
  title: string
  /** A muted phrase set right after the title, at the same size. */
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
  /** Sets the title one step larger, for sheets that are products rather than parts of a figure. */
  large?: boolean
}) => (
  <div className="dark:bg-polar-900 flex min-h-0 w-full flex-col rounded-xl bg-white">
    <Box flexDirection="column" rowGap="l" padding="xl" height="100%">
      <Box justifyContent="between" alignItems="baseline" columnGap="l">
        <Box alignItems="baseline" columnGap="m" flexWrap="wrap">
          <Text variant={large ? 'heading-xxs' : 'body'}>{title}</Text>
          {subtitle ? (
            <Text variant={large ? 'heading-xxs' : 'body'} color="muted">
              {subtitle}
            </Text>
          ) : null}
        </Box>
        {aside}
      </Box>
      {children}
    </Box>
  </div>
)

/** The three flow images, as static classes so Tailwind can see them. Chapters rotate through them in page order. */
export const FLOW = {
  1: 'bg-[url(/assets/landing/company/Polar_Flow_01_No_Logo.jpg)]',
  2: 'bg-[url(/assets/landing/company/Polar_Flow_02_No_Logo.jpg)]',
  3: 'bg-[url(/assets/landing/company/Polar_Flow_03_No_Logo.jpg)]',
} as const
export type Flow = keyof typeof FLOW

/** The hero's window chrome on its own: a dark frame with a hairline and a 4px inset, the logo and an aside on top. */
export const WindowFrame = ({
  aside,
  children,
  narrow = false,
  className = '',
}: {
  aside?: ReactNode
  children: ReactNode
  /** Caps the window's width for figures that read better compact. */
  narrow?: boolean
  className?: string
}) => (
  <div
    className={`dark:bg-polar-950 dark:border-polar-800 relative mx-auto flex w-full min-w-0 flex-col rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] ${narrow ? 'max-w-[56rem]' : ''} ${className}`}
  >
    <Box
      alignItems="center"
      justifyContent="between"
      columnGap="l"
      paddingHorizontal="xl"
      paddingVertical="m"
    >
      <LogoType height={14} />
      {typeof aside === 'string' ? (
        <Text variant="caption" color="muted">
          {aside}
        </Text>
      ) : (
        aside
      )}
    </Box>
    {children}
  </div>
)

/** A figure window in the hero's chrome: the dimmed flow image, a dark frame, the figure label and an aside. */
export const Window = ({
  flow,
  aside,
  children,
  innerRef,
  narrow = false,
  bare = false,
}: {
  flow: Flow
  /** Drops the image container, leaving just the window on the page. */
  bare?: boolean
  /** Caps the window's width for figures that read better compact. */
  narrow?: boolean
  aside?: string
  children: ReactNode
  innerRef?: Ref<HTMLDivElement>
}) => (
  <div
    ref={innerRef}
    className={
      bare
        ? 'relative w-full'
        : `dark:border-polar-800 relative w-full overflow-hidden rounded-md border border-gray-200 bg-cover bg-center p-4 md:p-12 ${FLOW[flow]}`
    }
  >
    {bare ? null : (
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
    )}
    <WindowFrame aside={aside} narrow={narrow}>
      {children}
    </WindowFrame>
  </div>
)
