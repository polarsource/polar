import { useTheme } from '@/hooks/theme'
import { themes } from '@/utils/theme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Stack } from 'expo-router'
import {
  TabList,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui'
import { ComponentProps, PropsWithChildren, Ref } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function Layout() {
  return (
    <Tabs>
      <Stack.Screen options={{ title: 'Tabs' }} />
      <TabSlot />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="test" href="/(authenticated)/(tabs)/test" asChild>
            <TabButton icon="space-dashboard" />
          </TabTrigger>
          <TabTrigger
            name="events"
            href="/(authenticated)/(tabs)/events"
            asChild
          >
            <TabButton icon="all-inclusive" />
          </TabTrigger>
          <TabTrigger name="home" href="/(authenticated)/home" asChild>
            <TabButton icon="people" />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  )
}

interface CustomTabListProps extends PropsWithChildren {}

const CustomTabList = ({ children }: CustomTabListProps) => {
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
    padding: 8,
    gap: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
})

type Icon = ComponentProps<typeof MaterialIcons>['name']

export type TabButtonProps = TabTriggerSlotProps & {
  icon?: Icon
  ref: Ref<View>
}

export function TabButton({
  icon,
  children,
  isFocused,
  ...props
}: TabButtonProps) {
  const { colors } = useTheme()

  return (
    <Pressable
      {...props}
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
      ]}
    >
      <MaterialIcons
        name={icon}
        style={[{ fontSize: 20, color: isFocused ? 'white' : colors.subtext }]}
      />
    </Pressable>
  )
}
