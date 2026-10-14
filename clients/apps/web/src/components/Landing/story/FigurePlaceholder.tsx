import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

/**
 * Stand-in for a chapter's figure, in the hero's chrome: the dimmed flow image, and a frame naming what the
 * figure will show. Replaced chapter by chapter as the real visuals land.
 */
export const FigurePlaceholder = ({
  figure,
  title,
  shows,
}: {
  figure: string
  title: string
  shows: string[]
}) => (
  <div className="dark:border-polar-800 relative flex min-h-[22rem] w-full items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-[url(/assets/landing/company/Polar_Flow_03_No_Logo.jpg)] bg-cover bg-center px-4 py-12 md:min-h-[30rem] md:px-12">
    <div className="pointer-events-none absolute inset-0 bg-black/60" />
    <div className="dark:bg-polar-950 dark:border-polar-800 relative flex w-full max-w-[34rem] flex-col rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        paddingHorizontal="l"
        paddingVertical="m"
      >
        <Text variant="caption" monospace color="muted">
          {figure}
        </Text>
        <Text variant="caption" color="muted">
          Placeholder
        </Text>
      </Box>
      <div className="dark:bg-polar-900 flex w-full flex-col rounded-xl bg-white">
        <Box flexDirection="column" rowGap="m" padding="xl">
          <Text variant="body">{title}</Text>
          <Box as="ul" flexDirection="column" rowGap="xs">
            {shows.map((line) => (
              <Box as="li" key={line}>
                <Text variant="caption" color="muted">
                  {line}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </div>
    </div>
  </div>
)
