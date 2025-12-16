import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

interface MetadataCardProps {
  fields: { key: string; value: string }[]
  onAdd: () => void
  onRemove: (index: number) => void
}

export const MetadataCard = ({
  fields,
  onAdd,
  onRemove,
}: MetadataCardProps) => {
  const theme = useTheme()

  return (
    <Box flexDirection="column" gap="spacing-12">
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Text variant="bodyMedium" color="subtext">
          Metadata
        </Text>
        <Button
          size="small"
          onPress={onAdd}
          icon={
            <MaterialIcons
              name="add"
              size={16}
              color={theme.colors.monochrome}
            />
          }
        >
          Add
        </Button>
      </Box>
      {fields.length === 0 ? (
        <Box
          padding="spacing-16"
          backgroundColor="card"
          borderRadius="border-radius-12"
        >
          <Text variant="body" color="subtext">
            No metadata
          </Text>
        </Box>
      ) : (
        <Box
          flexDirection="column"
          backgroundColor="card"
          borderRadius="border-radius-12"
          overflow="hidden"
        >
          {fields.map((field, index) => (
            <Box
              key={`${field.key}-${index}`}
              flexDirection="row"
              alignItems="center"
              padding="spacing-16"
              gap="spacing-12"
              borderBottomWidth={index < fields.length - 1 ? 1 : 0}
              borderColor="border"
            >
              <Box flex={1} flexDirection="column" gap="spacing-4">
                <Text variant="bodySmall" color="subtext">
                  {field.key}
                </Text>
                <Text variant="body">{field.value}</Text>
              </Box>
              <Touchable onPress={() => onRemove(index)}>
                <MaterialIcons
                  name="close"
                  size={20}
                  color={theme.colors.subtext}
                />
              </Touchable>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
