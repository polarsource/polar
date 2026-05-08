'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { useState } from 'react'

interface EscalationCardProps {
  initialSummary: string
  onSubmit: (summary: string) => void
  onCancel: () => void
  isSubmitting: boolean
}

export const EscalationCard = ({
  initialSummary,
  onSubmit,
  onCancel,
  isSubmitting,
}: EscalationCardProps) => {
  const [summary, setSummary] = useState(initialSummary)

  return (
    <div className="dark:border-polar-700 flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Escalate to support</p>
        <p className="dark:text-polar-400 text-xs text-gray-500">
          We&apos;ve drafted a summary for the support team. Edit it before
          sending — the conversation transcript will be included automatically.
        </p>
      </div>
      <TextArea
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        rows={5}
        disabled={isSubmitting}
      />
      <div className="flex justify-end gap-2">
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
          onClick={() => onSubmit(summary)}
          loading={isSubmitting}
          disabled={isSubmitting || !summary.trim()}
        >
          Send to support
        </Button>
      </div>
    </div>
  )
}
