import { useTheme } from '@/hooks/theme'
import { Stack as StackRouter } from 'expo-router'
import { PropsWithChildren } from 'react'

export function Stack({ children }: PropsWithChildren) {
  const { colors } = useTheme()
  return (
    <StackRouter
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {children}
    </StackRouter>
  )
}
