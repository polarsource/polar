import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { Pressable } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface FABMenuItem {
  icon: keyof typeof MaterialIcons.glyphMap
  label: string
  href: string
}

const MENU_ITEMS: FABMenuItem[] = [
  { icon: 'inventory-2', label: 'Products', href: '/catalogue' },
  {
    icon: 'link',
    label: 'Checkout Links',
    href: '/catalogue?tab=checkout-links',
  },
]

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export const FAB = () => {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [isOpen, setIsOpen] = useState(false)

  const rotation = useSharedValue(0)

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => {
      const newValue = !prev
      rotation.value = withSpring(newValue ? 1 : 0, {
        damping: 15,
        stiffness: 200,
      })
      return newValue
    })
  }, [rotation])

  const handleItemPress = useCallback(
    (href: string) => {
      setIsOpen(false)
      rotation.value = withSpring(0, { damping: 15, stiffness: 200 })
      router.push(href as `${string}:${string}`)
    },
    [router, rotation],
  )

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(rotation.value, [0, 1], [1, 0.95]),
      },
    ],
    opacity: interpolate(rotation.value, [0, 1], [1, 0.8]),
  }))

  return (
    <>
      {isOpen ? (
        <AnimatedPressable
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          onPress={toggleMenu}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // eslint-disable-next-line @polar/no-hardcoded-colors
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        />
      ) : null}

      <Box
        position="absolute"
        style={{
          right: theme.spacing['spacing-16'],
          bottom: insets.bottom + theme.spacing['spacing-16'],
        }}
        alignItems="flex-end"
        gap="spacing-12"
      >
        {isOpen
          ? MENU_ITEMS.map((item, index) => (
              <Animated.View
                key={item.href}
                entering={FadeIn.delay(index * 50).duration(150)}
                exiting={FadeOut.duration(100)}
              >
                <Touchable onPress={() => handleItemPress(item.href)}>
                  <Box
                    flexDirection="row"
                    alignItems="center"
                    gap="spacing-12"
                    backgroundColor="card"
                    paddingVertical="spacing-12"
                    paddingHorizontal="spacing-16"
                    borderRadius="border-radius-12"
                    style={{
                      shadowColor: theme.colors.monochrome,
                      // eslint-disable-next-line @polar/no-hardcoded-dimensions
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    <MaterialIcons
                      name={item.icon}
                      size={20}
                      color={theme.colors['foreground-regular']}
                    />
                    <Text variant="bodyMedium">{item.label}</Text>
                  </Box>
                </Touchable>
              </Animated.View>
            ))
          : null}

        <Touchable onPress={toggleMenu}>
          <Animated.View style={fabAnimatedStyle}>
            <Box
              width={52}
              height={52}
              borderRadius="border-radius-100"
              backgroundColor="monochromeInverted"
              borderWidth={1}
              borderColor="border"
              justifyContent="center"
              alignItems="center"
              style={{
                shadowColor: theme.colors.monochrome,
                // eslint-disable-next-line @polar/no-hardcoded-dimensions
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <MaterialIcons
                name="storefront"
                size={24}
                color={theme.colors.monochrome}
              />
            </Box>
          </Animated.View>
        </Touchable>
      </Box>
    </>
  )
}
