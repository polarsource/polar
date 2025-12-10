import { Box } from '@/components/Shared/Box'
import { Href, Link } from 'expo-router'
import { PropsWithChildren } from 'react'
import { TouchableOpacity } from 'react-native'

export interface TileProps extends PropsWithChildren {
  href: Href
}

export const Tile = ({ href, children }: TileProps) => {
  return (
    <Link href={href} asChild>
      <TouchableOpacity activeOpacity={0.6}>
        <Box
          backgroundColor="card"
          padding="spacing-20"
          borderRadius="border-radius-24"
          flex={1}
          style={{ aspectRatio: 1 }}
        >
          {children}
        </Box>
      </TouchableOpacity>
    </Link>
  )
}
