import { Box } from '@/components/Shared/Box'
import { Href, Link } from 'expo-router'
import { PropsWithChildren } from 'react'
import { Touchable } from '../Shared/Touchable'

export type TileWithLinkProps = PropsWithChildren & {
  href: Href
}

export type TileWithOnPressProps = PropsWithChildren & {
  onPress: () => void
}

export type TileProps = TileWithLinkProps | TileWithOnPressProps

export const Tile = ({ children, ...props }: TileProps) => {
  if ('href' in props) {
    return (
      <Link href={props.href} asChild>
        <Touchable>
          <Box
            backgroundColor="card"
            padding="spacing-20"
            borderRadius="border-radius-24"
            flex={1}
            style={{ aspectRatio: 1 }}
          >
            {children}
          </Box>
        </Touchable>
      </Link>
    )
  }

  return (
    <Touchable onPress={props.onPress}>
      <Box
        backgroundColor="card"
        padding="spacing-20"
        borderRadius="border-radius-24"
        flex={1}
        style={{ aspectRatio: 1 }}
      >
        {children}
      </Box>
    </Touchable>
  )
}
