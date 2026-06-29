'use client'

import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { X } from 'lucide-react'

interface GrantBenefitSelectedItemProps {
  benefit: schemas['Benefit']
  onRemove: (benefitId: string) => void
}

export const GrantBenefitSelectedItem = ({
  benefit,
  onRemove,
}: GrantBenefitSelectedItemProps) => {
  return (
    <Box
      as="li"
      display="flex"
      alignItems="center"
      columnGap="m"
      padding="m"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
    >
      <Box
        alignItems="center"
        justifyContent="center"
        width={36}
        height={36}
        borderRadius="s"
        backgroundColor="background-secondary"
        color="text-secondary"
        flexShrink={0}
      >
        {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
      </Box>
      <Box flexDirection="column" flexGrow={1} minWidth={0}>
        <Text variant="body">{benefit.description}</Text>
        <Text variant="caption" color="muted">
          {benefitsDisplayNames[benefit.type]}
        </Text>
      </Box>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(benefit.id)}
        aria-label={`Remove ${benefit.description}`}
        className="text-gray-400 transition-transform duration-150 ease-out active:scale-97"
      >
        <X className="h-4 w-4" />
      </Button>
    </Box>
  )
}
