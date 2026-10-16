import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface InlineEditRowProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  placeholder?: string
  submitLabel?: string
  type?: 'text' | 'email'
  loading?: boolean
  error?: string
}

export const InlineEditRow = ({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
  submitLabel = 'Save',
  type = 'text',
  loading = false,
  error,
}: InlineEditRowProps) => {
  const saveDisabled = value.trim().length === 0
  return (
    <Box
      as="li"
      display="flex"
      flexDirection={{ base: 'column', sm: 'row' }}
      alignItems={{ base: 'stretch', sm: 'start' }}
      gap="s"
      padding="m"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box flexDirection="column" flex={1} gap="xs">
        <Input
          type={type}
          value={value}
          autoFocus
          placeholder={placeholder}
          disabled={loading}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !saveDisabled) {
              onSave()
            }
            if (e.key === 'Escape') {
              onCancel()
            }
          }}
        />
        {error && (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        )}
      </Box>
      <Box columnGap="s" justifyContent="end">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onSave}
          loading={loading}
          disabled={loading || saveDisabled}
        >
          {submitLabel}
        </Button>
      </Box>
    </Box>
  )
}
