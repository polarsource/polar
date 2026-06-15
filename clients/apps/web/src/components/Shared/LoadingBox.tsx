import { Box, type BoxProps } from '@polar-sh/orbit/Box'

export const LoadingBox = (props: BoxProps) => (
  <Box
    display="block"
    {...props}
    // eslint-disable-next-line polar/no-classname-box
    className="dark:bg-polar-700 animate-pulse bg-gray-100"
  />
)
