import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useState } from 'react'
import { Text } from './Text'
import { Touchable } from './Touchable'

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
      <Touchable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing['spacing-8'],
          justifyContent: 'space-between',
          paddingVertical: theme.spacing['spacing-12'],
          paddingHorizontal: theme.spacing['spacing-16'],
          borderRadius: theme.borderRadii['border-radius-12'],
          backgroundColor: theme.colors.card,
        }}
        onPress={() => setOpen(!open)}
        activeOpacity={0.6}
      >
        <Text>{title}</Text>
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={24}
          color={theme.colors.monochromeInverted}
        />
      </Touchable>
      {open && children}
    </Box>
  )
}
