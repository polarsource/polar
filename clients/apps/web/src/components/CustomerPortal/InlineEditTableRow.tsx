import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface InlineEditTableRowProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  placeholder?: string
  submitLabel?: string
  type?: 'text' | 'email'
  loading?: boolean
  error?: string
  colSpan?: number
}

export const InlineEditTableRow = ({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
  submitLabel = 'Save',
  type = 'text',
  loading = false,
  error,
  colSpan = 3,
}: InlineEditTableRowProps) => {
  const saveDisabled = value.trim().length === 0
  return (
    <tr className="border-b transition-colors">
      <td colSpan={colSpan} className="p-0">
        <Box alignItems="start" gap="l" p="l">
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
          <Button
            onClick={onSave}
            loading={loading}
            disabled={loading || saveDisabled}
          >
            {submitLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </Box>
      </td>
    </tr>
  )
}
