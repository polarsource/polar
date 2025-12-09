import { useTheme } from '@/hooks/theme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { TabTrigger, TabTriggerSlotProps } from 'expo-router/ui'
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
  const { colors } = useTheme()

  return (
    <View
      style={[
        styles.navigatorContainer,
        {
          paddingBottom: safeAreaInsets.bottom + 8,
          paddingHorizontal: safeAreaInsets.left + 24,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
      ]}
    >
      <LinearGradient
        colors={['transparent', '#08080A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <TabsBar>{children}</TabsBar>
      <TabsBar>
        <TabTrigger name="search" href="/(authenticated)/search" asChild>
          <TabButton icon="search" />
        </TabTrigger>
      </TabsBar>
    </View>
  )
}

export const TabsBar = ({ children }: PropsWithChildren) => {
  return <View style={styles.tabsBarContainer}>{children}</View>
}

const styles = StyleSheet.create({
  navigatorContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  tabsBarContainer: {
    backgroundColor: '#141418',
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
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
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 100,
            backgroundColor: isFocused ? colors.secondary : undefined,
          },
          animatedStyle,
        ]}
      >
        <MaterialIcons
          name={icon}
          style={[
            { fontSize: 24, color: isFocused ? 'white' : colors.subtext },
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}
