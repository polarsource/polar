'use client'

import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { useState } from 'react'

interface EscalationCardProps {
  initialType: schemas['FeedbackType']
  onSubmit: (note: string, type: schemas['FeedbackType']) => void
  onCancel: () => void
  isSubmitting: boolean
}

const TYPE_OPTIONS: { value: schemas['FeedbackType']; label: string }[] = [
  { value: 'question', label: 'Question' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'bug', label: 'Bug' },
]

export const EscalationCard = ({
  initialType,
  onSubmit,
  onCancel,
  isSubmitting,
}: EscalationCardProps) => {
  const [type, setType] = useState<schemas['FeedbackType']>(initialType)
  const [note, setNote] = useState('')

  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="m"
      padding="l"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box display="flex" flexDirection="column" rowGap="xs">
        <h3 className="text-sm font-medium">Send to the Polar team</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          The full transcript is included automatically. Add anything else
          you&apos;d like to share below.
        </p>
      </Box>
      <TextArea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Anything else you want to add?"
        rows={4}
        disabled={isSubmitting}
      />
      <Box
        display="flex"
        alignItems="center"
        justifyContent="between"
        columnGap="s"
      >
        <Select
          value={type}
          onValueChange={(value) => setType(value as schemas['FeedbackType'])}
          disabled={isSubmitting}
        >
          <SelectTrigger className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Box display="flex" columnGap="s">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(note, type)}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Send
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
