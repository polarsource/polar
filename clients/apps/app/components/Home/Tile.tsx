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

export type TileProps = (TileWithLinkProps | TileWithOnPressProps) & {
  square?: boolean
}

export const Tile = ({ children, square = true, ...props }: TileProps) => {
  const content = (
    <Box
      backgroundColor="card"
      padding="spacing-20"
      borderRadius="border-radius-24"
      flex={1}
      style={{ aspectRatio: square ? 1 : undefined }}
    >
      {children}
    </Box>
  )

  if ('href' in props) {
    return (
      <Link href={props.href} asChild>
        <Touchable style={{ flex: 1 }}>{content}</Touchable>
      </Link>
    )
  }

  return (
    <Touchable style={{ flex: 1 }} onPress={props.onPress}>
      {content}
    </Touchable>
  )
}
