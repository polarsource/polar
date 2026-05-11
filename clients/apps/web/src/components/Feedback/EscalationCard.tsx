'use client'

import { schemas } from '@polar-sh/client'
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
  initialSummary: string
  initialType: schemas['FeedbackType']
  onSubmit: (summary: string, type: schemas['FeedbackType']) => void
  onCancel: () => void
  isSubmitting: boolean
}

const TYPE_OPTIONS: { value: schemas['FeedbackType']; label: string }[] = [
  { value: 'question', label: 'Question' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'bug', label: 'Bug' },
]

export const EscalationCard = ({
  initialSummary,
  initialType,
  onSubmit,
  onCancel,
  isSubmitting,
}: EscalationCardProps) => {
  const [summary, setSummary] = useState(initialSummary)
  const [type, setType] = useState<schemas['FeedbackType']>(initialType)

  return (
    <div className="dark:border-polar-700 flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Send to the Polar team</p>
        <p className="dark:text-polar-400 text-xs text-gray-500">
          The full transcript is included automatically.
        </p>
      </div>
      <TextArea
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        rows={5}
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-between gap-2">
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
        <div className="flex gap-2">
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
            onClick={() => onSubmit(summary, type)}
            loading={isSubmitting}
            disabled={isSubmitting || !summary.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
