import { Box, type BoxProps } from '@polar-sh/orbit/Box'

/** The bordered white surface every panel, row and node in the app sits on. */
export const Card = <
  E extends 'div' | 'section' | 'aside' | 'main' | 'form' | 'li',
>(
  props: BoxProps<E>,
) => (
  <Box
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    backgroundColor="background-primary"
    {...props}
  />
)
