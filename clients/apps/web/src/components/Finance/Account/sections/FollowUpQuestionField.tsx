'use client'

import type { FollowUpQuestion } from '@/utils/aup'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  type LucideIcon,
} from 'lucide-react'

export type FollowUpStatus = 'pending' | 'approved' | 'denied'

interface Props {
  question: FollowUpQuestion
  value: string | undefined
  onChange: (value: string) => void
  status: FollowUpStatus
  reason?: string | null
}

const STATUS_APPEARANCE: Record<
  FollowUpStatus,
  { icon: LucideIcon; color: 'warning' | 'success' | 'danger' }
> = {
  pending: { icon: AlertTriangleIcon, color: 'warning' },
  approved: { icon: CheckIcon, color: 'success' },
  denied: { icon: AlertCircleIcon, color: 'danger' },
}

export const FollowUpQuestionField = ({
  question,
  value,
  onChange,
  status,
  reason,
}: Props) => {
  const maxLength = question.max_length ?? 500
  const { icon: Icon, color } = STATUS_APPEARANCE[status]

  const aupLink = (
    <a
      href="https://polar.sh/legal/acceptable-use-policy"
      target="_blank"
      rel="noopener noreferrer"
      className="dark:text-polar-300 dark:hover:text-polar-100 inline-flex items-baseline gap-x-1 text-gray-700 underline underline-offset-2 hover:text-gray-900"
    >
      Acceptable Use Policy
    </a>
  )

  return (
    <Box display="flex" flexDirection="column" rowGap="xs">
      <Box display="flex" alignItems="center" columnGap="xs">
        <Box color={`text-${color}` as const} display="inline-flex">
          <Icon className="h-3.5 w-3.5" />
        </Box>
        <Text variant="label" color={color}>
          {question.label}
        </Text>
      </Box>
      <Box marginBottom="xs">
        <Text variant="caption" color="muted">
          {question.description ? `${question.description} ` : ''}Review our{' '}
          {aupLink}.
        </Text>
      </Box>
      {question.type === 'text' && (
        <TextArea
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          className="resize-none"
        />
      )}
      {question.type === 'choice' && (question.options ?? []).length > 0 && (
        <Box
          as="fieldset"
          display="flex"
          flexDirection="column"
          rowGap="xs"
          marginTop="s"
        >
          {(question.options ?? []).map((option) => (
            <Box
              as="label"
              key={option}
              display="flex"
              alignItems="center"
              columnGap="s"
              cursor="pointer"
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              <Text variant="caption">{option}</Text>
            </Box>
          ))}
        </Box>
      )}
      {reason && (
        <Box marginTop="xs">
          <Text variant="caption" color="warning">
            {reason}
          </Text>
        </Box>
      )}
    </Box>
  )
}
