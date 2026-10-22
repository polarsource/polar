import { useTheme } from '@/design-system/useTheme'
import { Href, Stack, useRouter } from 'expo-router'
import { ComponentProps } from 'react'

type Icon = ComponentProps<typeof Stack.Toolbar.Button>['icon']

const items: { icon: Icon; label: string; href: Href }[] = [
  { icon: 'bag', label: 'Orders', href: '/orders' },
  {
    icon: 'arrow.triangle.2.circlepath',
    label: 'Subscriptions',
    href: '/subscriptions',
  },
  { icon: 'chart.xyaxis.line', label: 'Stats', href: '/metrics' },
  { icon: 'gearshape', label: 'Settings', href: '/settings' },
]

export const DuoToolbar = () => {
  const router = useRouter()
  const theme = useTheme()

  return (
    <Stack.Toolbar placement="bottom" tintColor={theme.colors.text}>
      {items.map((item) => (
        <Stack.Toolbar.Button
          key={item.label}
          icon={item.icon}
          accessibilityLabel={item.label}
          onPress={() => router.push(item.href)}
        />
      ))}
    </Stack.Toolbar>
  )
}
