import { Box } from '@/components/Shared/Box'
import { Switch } from '@/components/Shared/Switch'
import { Text } from '@/components/Shared/Text'
import { Control, Controller } from 'react-hook-form'

interface SettingsCardProps {
  control: Control<{
    allow_discount_codes: boolean
    require_billing_address: boolean
    label: string
    success_url: string
    metadata: { key: string; value: string }[]
  }>
}

export const SettingsCard = ({ control }: SettingsCardProps) => {
  return (
    <Box flexDirection="column" gap="spacing-12">
      <Text variant="bodyMedium" color="subtext">
        Settings
      </Text>
      <Box
        flexDirection="column"
        backgroundColor="card"
        borderRadius="border-radius-12"
        overflow="hidden"
      >
        <Controller
          control={control}
          name="allow_discount_codes"
          render={({ field: { onChange, value } }) => (
            <Box
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              padding="spacing-16"
              borderBottomWidth={1}
              borderColor="border"
            >
              <Box flex={1} flexDirection="column" gap="spacing-4">
                <Text variant="body">Allow discount codes</Text>
                <Text variant="bodySmall" color="subtext">
                  {value
                    ? 'Customers can apply discount codes'
                    : 'Customers cannot apply discount codes'}
                </Text>
              </Box>
              <Switch value={value} onValueChange={onChange} />
            </Box>
          )}
        />
        <Controller
          control={control}
          name="require_billing_address"
          render={({ field: { onChange, value } }) => (
            <Box
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              padding="spacing-16"
            >
              <Box flex={1} flexDirection="column" gap="spacing-4">
                <Text variant="body">Require billing address</Text>
                <Text variant="bodySmall" color="subtext">
                  {value
                    ? 'Full billing address required'
                    : 'Only country required'}
                </Text>
              </Box>
              <Switch value={value} onValueChange={onChange} />
            </Box>
          )}
        />
      </Box>
    </Box>
  )
}
