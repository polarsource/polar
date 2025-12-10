import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from 'react'
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native'
import { ThemedText } from './ThemedText'

const TabsContext = createContext({
  activeValue: '',
  setActiveValue: (value: string) => {},
})

export const Tabs = ({
  defaultValue,
  onValueChange,
  children,
}: {
  defaultValue: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}) => {
  const [activeValue, setActiveValue] = useState(defaultValue)

  const handleValueChange = useCallback(
    (value: string) => {
      setActiveValue(value)
      onValueChange?.(value)
    },
    [onValueChange],
  )

  return (
    <TabsContext.Provider
      value={{
        activeValue,
        setActiveValue: (value) => {
          setActiveValue(value)
          handleValueChange(value)
        },
      }}
    >
      {children}
    </TabsContext.Provider>
  )
}

export const TabsContent = ({
  children,
  style,
  value,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  value: string
}) => {
  const { activeValue } = useContext(TabsContext)

  if (activeValue !== value) return null

  return <Box style={style}>{children}</Box>
}

export const TabsList = ({ children }: PropsWithChildren) => {
  return (
    <Box
      flexDirection="row"
      gap="spacing-8"
      backgroundColor="card"
      padding="spacing-4"
      borderRadius="border-radius-16"
    >
      {children}
    </Box>
  )
}

export interface TabsTriggerProps {
  value: string
  children: React.ReactNode
}

export const TabsTrigger = ({ value, children }: TabsTriggerProps) => {
  const theme = useTheme()

  const { activeValue, setActiveValue } = useContext(TabsContext)

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      style={[
        {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderRadius: 12,
          flex: 1,
        },
        activeValue === value && {
          backgroundColor: theme.colors.background,
        },
      ]}
      onPress={() => {
        setActiveValue(value)
      }}
    >
      <ThemedText>{children}</ThemedText>
    </TouchableOpacity>
  )
}
