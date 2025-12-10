import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { ThemedText } from './ThemedText'

export interface AccordionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export const Accordion = ({
  title,
  children,
  defaultOpen = false,
}: AccordionProps) => {
  const [open, setOpen] = useState(defaultOpen)
  const theme = useTheme()

  return (
    <Box flex={1} flexDirection="column" gap="spacing-12">
      <TouchableOpacity
        style={[styles.header, { backgroundColor: theme.colors.card }]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.6}
      >
        <ThemedText style={styles.title}>{title}</ThemedText>
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={24}
          color={theme.colors.monochromeInverted}
        />
      </TouchableOpacity>
      {open && children}
    </Box>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 16,
  },
})
