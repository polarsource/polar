import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren } from 'react'

export type SectionProps = PropsWithChildren<{
  id?: string
  paddingTop?: boolean
}>

export const Section = ({ id, paddingTop = true, children }: SectionProps) => {
  return (
    <Box
      id={id}
      display="flex"
      position="relative"
      flexDirection="column"
      alignItems={{
        md: 'center',
      }}
    >
      <Box
        display="flex"
        width="100%"
        flexDirection="column"
        paddingVertical={{
          base: '3xl',
          md: '4xl',
        }}
        paddingTop={{ md: !paddingTop ? 'none' : undefined }}
        maxWidth={{
          md: '1280px',
        }}
        rowGap="2xl"
      >
        {children}
      </Box>
    </Box>
  )
}
