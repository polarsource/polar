import LogoType from '@/components/Brand/logos/LogoType'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode, Ref } from 'react'

/** A sheet inside a figure window: a body-size title, an optional aside, and its content filling the height. */
export const Sheet = ({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) => (
  <div className="dark:bg-polar-900 flex min-h-0 w-full flex-col rounded-xl bg-white">
    <Box flexDirection="column" rowGap="l" padding="xl" height="100%">
      <Box justifyContent="between" alignItems="baseline" columnGap="l">
        <Text variant="body">{title}</Text>
        {aside}
      </Box>
      {children}
    </Box>
  </div>
)

/** A figure window in the hero's chrome: the dimmed flow image, a dark frame, the figure label and an aside. */
export const Window = ({
  aside,
  children,
  innerRef,
}: {
  aside: string
  children: ReactNode
  innerRef?: Ref<HTMLDivElement>
}) => (
  <div
    ref={innerRef}
    className="dark:border-polar-800 relative w-full overflow-hidden rounded-md border border-gray-200 bg-[url(/assets/landing/company/Polar_Flow_03_No_Logo.jpg)] bg-cover bg-center p-4 md:p-12"
  >
    <div className="pointer-events-none absolute inset-0 bg-black/40" />
    <div className="dark:bg-polar-950 dark:border-polar-800 relative flex w-full flex-col rounded-3xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
      <Box
        alignItems="center"
        justifyContent="between"
        paddingHorizontal="xl"
        paddingVertical="m"
      >
        <LogoType height={14} />
        <Text variant="caption" color="muted">
          {aside}
        </Text>
      </Box>
      {children}
    </div>
  </div>
)
