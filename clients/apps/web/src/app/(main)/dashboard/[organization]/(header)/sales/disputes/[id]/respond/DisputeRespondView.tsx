'use client'

import { DisputeContextView } from '@/components/Disputes/DisputeContextView'
import {
  DisputeEvidenceState,
  DisputeEvidenceUpload,
} from '@/components/Disputes/DisputeEvidenceUpload'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import { useReplyToSupportCase } from '@/hooks/queries/org'
import { useOrder } from '@/hooks/queries/orders'
import { getDisputeReasonExplanation } from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Textarea } from '@polar-sh/orbit/ui/textarea'
import { Label } from '@polar-sh/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const MIN_EXPLANATION_LENGTH = 20

const REASON_OPTIONS = [
  {
    value: 'cardholder_withdrew',
    label: 'The cardholder withdrew the dispute',
  },
  { value: 'cardholder_refunded', label: 'The cardholder was refunded' },
  {
    value: 'rightful_cardholder',
    label: 'The purchase was made by the rightful cardholder',
  },
  { value: 'other', label: 'Other' },
] as const satisfies readonly {
  value: schemas['DisputeWinReason']
  label: string
}[]

interface Props {
  organization: schemas['Organization']
  dispute: schemas['Dispute']
}

export const DisputeRespondView = ({ organization, dispute }: Props) => {
  const router = useRouter()
  const disputePath = `/dashboard/${organization.slug}/sales/disputes/${dispute.id}`
  const caseId = dispute.case_id
  const { data: order } = useOrder(dispute.order_id)

  const [reason, setReason] = useState<schemas['DisputeWinReason'] | ''>('')
  const [otherReason, setOtherReason] = useState('')
  const [explanation, setExplanation] = useState('')
  const [evidence, setEvidence] = useState<DisputeEvidenceState>({
    fileIds: [],
    isUploading: false,
  })
  const reply = useReplyToSupportCase()

  const hasReason = reason !== ''
  const otherReasonProvided =
    reason === 'other' ? otherReason.trim().length > 0 : true
  const hasExplanation = explanation.trim().length >= MIN_EXPLANATION_LENGTH
  const hasCase = caseId != null

  const isValid = hasReason && otherReasonProvided && hasExplanation && hasCase

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValid || evidence.isUploading || caseId == null) {
      return
    }
    const result = await reply.mutateAsync({
      caseId,
      body: explanation.trim(),
      file_ids: evidence.fileIds,
      dispute_win_reason: reason || null,
      dispute_win_reason_other: reason === 'other' ? otherReason.trim() : null,
    })
    if (result.error) {
      toast({
        title: 'Something went wrong',
        description: 'Could not submit your response. Please try again.',
      })
      return
    }
    router.push(disputePath)
  }

  return (
    <DashboardBody
      title={
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h2">
            Counter dispute
          </Text>
          <Text color="muted">
            {getDisputeReasonExplanation(dispute.reason)}
          </Text>
        </Box>
      }
      contextViewTitle="Details"
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:shadow-none"
      contextView={
        order ? (
          <DisputeContextView organization={organization} order={order} />
        ) : undefined
      }
    >
      <div className="w-full">
        <form onSubmit={handleSubmit}>
          <Box flexDirection="column" rowGap="xl">
            <Box flexDirection="column" rowGap="xs">
              <Box flexDirection="column" rowGap="xs" marginBottom="s">
                <Text variant="heading-xxs" as="h3">
                  Why should you win this dispute?
                </Text>
                <Text variant="caption" color="muted">
                  Choose the reason that best describes your case.
                </Text>
              </Box>
              <RadioGroup
                value={reason}
                onValueChange={(value) =>
                  setReason(value as schemas['DisputeWinReason'])
                }
              >
                {REASON_OPTIONS.map((option) => (
                  <Box key={option.value} alignItems="center" columnGap="m">
                    <RadioGroupItem
                      value={option.value}
                      id={`reason-${option.value}`}
                    />
                    <Label
                      htmlFor={`reason-${option.value}`}
                      className="cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </Box>
                ))}
              </RadioGroup>
              {reason === 'other' && (
                <Box marginTop="s">
                  <Input
                    value={otherReason}
                    onChange={(event) => setOtherReason(event.target.value)}
                    placeholder="Tell us why you should win"
                    maxLength={500}
                    autoFocus
                  />
                </Box>
              )}
            </Box>

            <Box flexDirection="column" rowGap="xs">
              <Box flexDirection="column" rowGap="xs" marginBottom="s">
                <Text variant="heading-xxs" as="h3">
                  Why is this payment legitimate?
                </Text>
                <Text variant="caption" color="muted">
                  Explain why the customer&apos;s claim is incorrect and include
                  any context that supports your case.
                </Text>
              </Box>
              <Textarea
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                placeholder="Describe the evidence that proves this payment is valid…"
                className="min-h-32"
                maxLength={5000}
              />
              <Box justifyContent="between">
                <Text variant="caption" color="muted">
                  Minimum {MIN_EXPLANATION_LENGTH} characters
                </Text>
                <Text variant="caption" color="muted">
                  {explanation.trim().length} / 5000
                </Text>
              </Box>
            </Box>

            <Box flexDirection="column" rowGap="xs">
              <Box flexDirection="column" rowGap="xs" marginBottom="s">
                <Text variant="heading-xxs" as="h3">
                  Supporting evidence
                </Text>
                <Text variant="caption" color="muted">
                  Upload any communication with the customer that you feel is
                  relevant to your case.
                </Text>
              </Box>
              <DisputeEvidenceUpload
                organization={organization}
                onChange={setEvidence}
              />
            </Box>

            <Box flexDirection="row" justifyContent="end" columnGap="m">
              <Link href={disputePath}>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                loading={reply.isPending}
                disabled={!isValid || evidence.isUploading}
              >
                Counter dispute
              </Button>
            </Box>
          </Box>
        </form>
      </div>
    </DashboardBody>
  )
}
