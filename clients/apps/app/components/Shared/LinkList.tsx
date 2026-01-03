import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Href, Link } from 'expo-router'

interface LinkListProps {
  items: {
    title: string
    meta?: string
    link: Href
  }[]
}

export const LinkList = ({ items }: LinkListProps) => {
  const theme = useTheme()

  return (
    <Box flexDirection="column" gap="spacing-12">
      <Box
        flexDirection="column"
        backgroundColor="card"
        borderRadius="border-radius-12"
        overflow="hidden"
      >
        {items.map((item, index) => (
          <Link href={item.link} key={item.title}>
            <Box
              key={item.title}
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              padding="spacing-12"
              borderBottomWidth={index < items.length - 1 ? 1 : 0}
              borderColor="border"
            >
              <Box
                flex={1}
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                gap="spacing-4"
              >
                <Text variant="body">{item.title}</Text>
                <Box flexDirection="row" alignItems="center" gap="spacing-8">
                  <Text variant="body" color="subtext">
                    {item.meta}
                  </Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={theme.colors.subtext}
                  />
                </Box>
              </Box>
            </Box>
          </Link>
        ))}
      </Box>
    </Box>
  )
}
