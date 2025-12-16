import { BottomSheet } from '@/components/Shared/BottomSheet'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { Input } from '@/components/Shared/Input'
import { Text } from '@/components/Shared/Text'
import { useState } from 'react'

export interface AddMetadataSheetProps {
  onDismiss: () => void
  onAdd: (key: string, value: string) => void
}

export const AddMetadataSheet = ({
  onDismiss,
  onAdd,
}: AddMetadataSheetProps) => {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')

  const handleAdd = () => {
    if (key.trim()) {
      onAdd(key.trim(), value)
      onDismiss()
    }
  }

  return (
    <BottomSheet onDismiss={onDismiss} enableDynamicSizing={true}>
      <Box gap="spacing-24">
        <Box flexDirection="column" gap="spacing-8">
          <Text variant="title">Add Metadata</Text>
          <Text variant="bodySmall" color="subtext">
            Add a key-value pair to store additional information.
          </Text>
        </Box>

        <Box flexDirection="column" gap="spacing-16">
          <Box flexDirection="column" gap="spacing-8">
            <Text variant="body" color="subtext">
              Key
            </Text>
            <Input
              value={key}
              onChangeText={setKey}
              placeholder="Enter key"
              autoCapitalize="none"
              autoFocus
            />
          </Box>

          <Box flexDirection="column" gap="spacing-8">
            <Text variant="body" color="subtext">
              Value
            </Text>
            <Input
              value={value}
              onChangeText={setValue}
              placeholder="Enter value"
              autoCapitalize="none"
            />
          </Box>
        </Box>

        <Button onPress={handleAdd} disabled={!key.trim()}>
          Add Metadata
        </Button>
      </Box>
    </BottomSheet>
  )
}
