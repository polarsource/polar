'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type {
  BackgroundColorToken,
  TextColorToken,
} from '@polar-sh/orbit/theme'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'success' | 'warning' | 'danger' | 'pending' | 'neutral'

const TONE_APPEARANCE: Record<
  Tone,
  { backgroundColor: BackgroundColorToken; color: TextColorToken }
> = {
  success: { backgroundColor: 'background-success', color: 'text-success' },
  warning: { backgroundColor: 'background-warning', color: 'text-warning' },
  danger: { backgroundColor: 'background-danger', color: 'text-danger' },
  pending: { backgroundColor: 'background-pending', color: 'text-pending' },
  neutral: { backgroundColor: 'background-card', color: 'text-secondary' },
}

interface Props {
  tone?: Tone
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}

export const StatusBlock = ({
  tone = 'neutral',
  icon: Icon,
  title,
  description,
  action,
}: Props) => {
  const appearance = TONE_APPEARANCE[tone]

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      rowGap="m"
      paddingVertical="xl"
      paddingHorizontal="l"
      textAlign="center"
    >
      {Icon && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            width={40}
            height={40}
            borderRadius="full"
            backgroundColor={appearance.backgroundColor}
            color={appearance.color}
          >
            <Icon className="h-5 w-5" />
          </Box>
        </motion.div>
      )}
      <Box
        display="flex"
        flexDirection="column"
        rowGap="xs"
        alignItems="center"
      >
        <Text variant="label" color="default">
          {title}
        </Text>
        {description && (
          <Box maxWidth={420}>
            <Text variant="caption" color="muted" wrap="balance">
              {description}
            </Text>
          </Box>
        )}
      </Box>
      {action && <Box marginTop="xs">{action}</Box>}
    </Box>
  )
}
