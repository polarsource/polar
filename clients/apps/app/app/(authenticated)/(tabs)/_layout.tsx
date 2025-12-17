import { CustomTabBar } from '@/components/TabBar/CustomTabBar'
import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="subscriptions" />
      <Tabs.Screen name="settings" />
    </Tabs>
  )
}
