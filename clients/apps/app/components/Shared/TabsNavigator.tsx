import { useTheme } from '@/hooks/theme'
import { themes } from '@/utils/theme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { TabTriggerSlotProps } from 'expo-router/ui'
import { ComponentProps, PropsWithChildren } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const TabsNavigator = ({ children }: PropsWithChildren) => {
  const safeAreaInsets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.container,
        {
          bottom: safeAreaInsets.bottom,
          left: safeAreaInsets.left + 16,
        },
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: themes.dark.card,
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: themes.dark.border,
  },
})

type Icon = ComponentProps<typeof MaterialIcons>['name']

export type TabButtonProps = TabTriggerSlotProps & {
  icon?: Icon
}

export function TabButton({
  icon,
  children,
  isFocused,
  ...props
}: TabButtonProps) {
  const { colors } = useTheme()
  const opacity = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Pressable
      {...props}
      // Animate opacity on press in/out
      onPressIn={(event) => {
        opacity.value = withTiming(0.5, { duration: 100 })
        if (props.onPressIn) props.onPressIn(event)
      }}
      onPressOut={(event) => {
        opacity.value = withTiming(1, { duration: 100 })
        if (props.onPressOut) props.onPressOut(event)
      }}
    >
      <Animated.View
        style={[
          {
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 100,
            backgroundColor: isFocused ? colors.secondary : undefined,
          },
          animatedStyle,
        ]}
      >
        <MaterialIcons
          name={icon}
          style={[
            { fontSize: 20, color: isFocused ? 'white' : colors.subtext },
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}
