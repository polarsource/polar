import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { FC } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabButton } from './TabButton'

type TabIconName = 'home' | 'receipt-long' | 'autorenew' | 'settings'

const TAB_CONFIG: {
  name: string
  icon: TabIconName
  iconFocused: TabIconName
}[] = [
  { name: 'home', icon: 'home', iconFocused: 'home' },
  { name: 'orders', icon: 'receipt-long', iconFocused: 'receipt-long' },
  {
    name: 'subscriptions',
    icon: 'autorenew',
    iconFocused: 'autorenew',
  },
  { name: 'settings', icon: 'settings', iconFocused: 'settings' },
]

export const CustomTabBar: FC<BottomTabBarProps> = ({ state, navigation }) => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const isTabFocused = (routeName: string) => {
    const index = state.routes.findIndex((route) => route.name === routeName)
    return state.index === index
  }

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      justifyContent="space-around"
      marginHorizontal="spacing-48"
      paddingVertical="spacing-4"
      paddingHorizontal="spacing-8"
      borderRadius="border-radius-999"
      backgroundColor="card"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + theme.spacing['spacing-12'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: theme.colors.monochrome,
        shadowOffset: { width: 0, height: theme.dimension['dimension-4'] },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {TAB_CONFIG.map((tab) => {
        const focused = isTabFocused(tab.name)
        return (
          <TabButton
            key={tab.name}
            focused={focused}
            onPress={() => navigation.navigate(tab.name)}
          >
            <MaterialIcons
              name={focused ? tab.iconFocused : tab.icon}
              size={24}
              color={focused ? theme.colors.text : theme.colors.subtext}
            />
          </TabButton>
        )
      })}
    </Box>
  )
}
