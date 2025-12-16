import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { BottomSheetProps as GorhomBottomSheetProps } from '@gorhom/bottom-sheet'
import { BottomSheet } from '../Shared/BottomSheet'
import { Box } from '../Shared/Box'
import { Text } from '../Shared/Text'
import { Touchable } from '../Shared/Touchable'

export interface SelectionSheetProps<T> {
  onDismiss?: () => void
  onSelect: (value: T) => void
  title: string
  description?: string
  items: { value: T; label: string }[]
  selectedValue?: T
  snapPoints?: GorhomBottomSheetProps['snapPoints']
}

export const SelectionSheet = <T,>({
  onDismiss,
  onSelect,
  title,
  items,
  selectedValue,
  description,
  snapPoints = ['40%'],
}: SelectionSheetProps<T>) => {
  const theme = useTheme()

  return (
    <BottomSheet
      onDismiss={onDismiss}
      snapPoints={snapPoints}
      enableDynamicSizing={true}
    >
      <Box gap="spacing-24">
        <Box flexDirection="column" gap="spacing-8">
          <Text variant="title">{title}</Text>
          {description ? (
            <Text variant="bodySmall" color="subtext">
              {description}
            </Text>
          ) : null}
        </Box>
        <Box flexDirection="column">
          {items.map((item) => (
            <Touchable
              key={item.label}
              style={{
                paddingVertical: theme.spacing['spacing-12'],
                paddingLeft: theme.spacing['spacing-16'],
                paddingRight: theme.spacing['spacing-24'],
                borderRadius: theme.borderRadii['border-radius-16'],
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing['spacing-12'],
                justifyContent: 'space-between',
                backgroundColor:
                  selectedValue === item.value ? theme.colors.card : undefined,
              }}
              onPress={() => {
                onSelect(item.value)
              }}
              activeOpacity={0.6}
            >
              <Box flexDirection="row" alignItems="center" gap="spacing-12">
                <Text>{item.label}</Text>
              </Box>
              {selectedValue === item.value ? (
                <MaterialIcons
                  name="check"
                  size={20}
                  color={theme.colors.monochromeInverted}
                />
              ) : null}
            </Touchable>
          ))}
        </Box>
      </Box>
    </BottomSheet>
  )
}
