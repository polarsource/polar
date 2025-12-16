import { Box } from '@/components/Shared/Box'
import { Image } from '@/components/Shared/Image/Image'
import { useTheme } from '@/design-system/useTheme'
import { PlaceholderBox } from './PlaceholderBox'
import { Text } from './Text'

const getInitials = (fullName: string) => {
  const allNames = fullName.trim().split(' ')
  const initials = allNames.reduce((acc, curr, index) => {
    if (index === 0 || index === allNames.length - 1) {
      acc = `${acc}${curr.charAt(0).toUpperCase()}`
    }
    return acc
  }, '')
  return initials
}

interface AvatarProps {
  name: string
  size?: number
  image?: string | null
  backgroundColor?: string
  loading?: boolean
}

export const Avatar = ({
  name,
  size = 32,
  image,
  backgroundColor,
  loading,
}: AvatarProps) => {
  const theme = useTheme()

  const initials = getInitials(name ?? '')

  let showInitials = true
  if (image) {
    const avatarHost = image.startsWith('http') ? new URL(image).host : null
    showInitials = avatarHost === 'www.gravatar.com'
  }

  if (loading) {
    return (
      <Box
        alignItems="center"
        justifyContent="center"
        position="relative"
        overflow="hidden"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      >
        <PlaceholderBox
          width={size}
          height={size}
          borderRadius="border-radius-4"
        />
      </Box>
    )
  }

  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: backgroundColor ?? theme.colors.monochrome,
      }}
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="hidden"
    >
      {showInitials ? (
        <Box
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            position: 'absolute',
            inset: 0,
          }}
          alignItems="center"
          justifyContent="center"
        >
          <Text style={{ fontSize: size / 3 }}>{initials}</Text>
        </Box>
      ) : null}
      {image ? (
        <Box position="absolute" style={{ inset: 0 }}>
          <Image
            style={{
              borderRadius: size / 2,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              height: size,
              width: size,
            }}
            source={{ uri: image }}
          />
        </Box>
      ) : null}
    </Box>
  )
}
