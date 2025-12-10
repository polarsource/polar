import { useTheme } from '@/design-system/useTheme'
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from 'react'
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native'
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

  return <View style={style}>{children}</View>
}

export const TabsList = ({ children }: PropsWithChildren) => {
  const theme = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        backgroundColor: theme.colors.card,
        padding: 4,
        borderRadius: 16,
      }}
    >
      {children}
    </View>
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
