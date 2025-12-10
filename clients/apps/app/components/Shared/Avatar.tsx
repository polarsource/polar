import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { Image } from 'react-native'
import { ThemedText } from './ThemedText'

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
}

export const Avatar = ({
  name,
  size = 32,
  image,
  backgroundColor,
}: AvatarProps) => {
  const theme = useTheme()

  const initials = getInitials(name ?? '')

  let showInitials = true
  if (image) {
    const avatarHost = image.startsWith('http') ? new URL(image).host : null
    showInitials = avatarHost === 'www.gravatar.com'
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
    >
      {showInitials && (
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
          <ThemedText style={{ fontSize: size / 3 }}>{initials}</ThemedText>
        </Box>
      )}
      {image && (
        <Image
          height={size}
          width={size}
          style={{
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            inset: 0,
            zIndex: 1,
          }}
          source={{ uri: image }}
        />
      )}
    </Box>
  )
}
