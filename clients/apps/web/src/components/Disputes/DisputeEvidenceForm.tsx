'use client'

import { Button, Input, Text, TextArea } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CheckCircle2, Paperclip } from 'lucide-react'
import React, { useRef, useState } from 'react'

const CHARGEBACK_FEES_URL =
  'https://polar.sh/docs/merchant-of-record/fees#dispute/chargeback-fees'

type Decision = 'counter' | 'accept'

const DECISION_OPTIONS: {
  value: Decision
  title: string
  description: string
}[] = [
  {
    value: 'counter',
    title: 'Counter the dispute',
    description:
      'Submit evidence and let us contest the chargeback on your behalf.',
  },
  {
    value: 'accept',
    title: 'Accept the dispute',
    description:
      'Concede the chargeback. The amount and fees are deducted from your balance.',
  },
]

const Field = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) => (
  <Box flexDirection="column" rowGap="s">
    <Box flexDirection="column" rowGap="xs">
      <Text variant="label">{label}</Text>
      {hint && (
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      )}
    </Box>
    {children}
  </Box>
)

interface Props {
  onSubmitted?: (decision: Decision) => void
}

export const DisputeEvidenceForm = ({ onSubmitted }: Props) => {
  const [decision, setDecision] = useState<Decision>('counter')
  const [usageLogs, setUsageLogs] = useState('')
  const [refundPolicyUrl, setRefundPolicyUrl] = useState('')
  const [termsUrl, setTermsUrl] = useState('')
  const [fileNames, setFileNames] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canSubmit = decision === 'accept' || usageLogs.trim().length > 0

  const onSubmit = async () => {
    setSubmitting(true)
    // Mock submit — no API call.
    await new Promise((resolve) => setTimeout(resolve, 600))
    setSubmitting(false)
    setSubmitted(true)
    onSubmitted?.(decision)
  }

  // After an "accept" there are no evidence fields to show read-only.
  const showFormCard = !submitted || decision === 'counter'

  // Grey out the input text once submitted to signal it is read-only.
  const readOnlyTextClass = submitted ? 'text-gray-500 dark:text-polar-500' : ''

  return (
    <>
      {submitted && (
        <Box
          alignItems="start"
          columnGap="m"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          backgroundColor="background-secondary"
          padding="xl"
        >
          <Box color="text-success" paddingTop="xs">
            <CheckCircle2 className="h-5 w-5" />
          </Box>
          <Box flexDirection="column" rowGap="xs">
            <Text variant="default">
              {decision === 'counter'
                ? 'Evidence submitted'
                : 'Dispute accepted'}
            </Text>
            <Text color="muted">
              {decision === 'counter'
                ? 'We are now reviewing the evidence. We will update this dispute once there is an outcome.'
                : 'No further action is needed from you.'}
            </Text>
          </Box>
        </Box>
      )}

      {showFormCard && (
        <Box
          flexDirection="column"
          rowGap="xl"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          backgroundColor="background-primary"
          padding="xl"
        >
          {!submitted && (
            <Field label="How should we handle this dispute?">
              <Box flexDirection={{ base: 'column', md: 'row' }} gap="m">
                {DECISION_OPTIONS.map((option) => {
                  const selected = decision === option.value
                  return (
                    <Box
                      as="label"
                      key={option.value}
                      flex={1}
                      flexDirection="column"
                      rowGap="xs"
                      borderRadius="m"
                      borderWidth={1}
                      borderStyle="solid"
                      borderColor={selected ? 'text-primary' : 'border-primary'}
                      backgroundColor={
                        selected ? 'background-secondary' : 'background-primary'
                      }
                      boxShadow={selected ? 's' : 'none'}
                      padding="l"
                      cursor={{ hover: 'pointer' }}
                      transitionProperty="common"
                      transitionDuration="fast"
                      onClick={() => setDecision(option.value)}
                    >
                      <Text variant="label">{option.title}</Text>
                      <Text variant="caption" color="muted">
                        {option.description}
                      </Text>
                    </Box>
                  )
                })}
              </Box>
            </Field>
          )}

          {decision === 'counter' && (
            <>
              <Field
                label="Usage logs"
                hint="Raw data showing the customer received and used the product."
              >
                <TextArea
                  rows={2}
                  value={usageLogs}
                  onChange={(e) => setUsageLogs(e.target.value)}
                  className={`resize-none ${readOnlyTextClass}`}
                  readOnly={submitted}
                />
              </Field>

              <Field
                label="Customer communication"
                hint="Any communication you've had with the customer, consolidated into a single PDF."
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) =>
                    setFileNames(
                      Array.from(e.target.files ?? []).map((f) => f.name),
                    )
                  }
                />
                <Box flexDirection="column" rowGap="s" alignItems="start">
                  {!submitted && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      wrapperClassNames="gap-x-2"
                    >
                      <Paperclip className="h-4 w-4" />
                      <span>Attach files</span>
                    </Button>
                  )}
                  {fileNames.length > 0 ? (
                    <Box flexDirection="column" rowGap="xs">
                      {fileNames.map((name) => (
                        <Box key={name} alignItems="center" columnGap="xs">
                          <Box color="text-secondary">
                            <Paperclip className="h-3.5 w-3.5" />
                          </Box>
                          <Text variant="caption" color="muted">
                            {name}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    submitted && (
                      <Text variant="caption" color="muted">
                        No files attached
                      </Text>
                    )
                  )}
                </Box>
              </Field>

              <Box
                display="grid"
                gridTemplateColumns={{ base: '1fr', md: '1fr 1fr' }}
                gap="l"
              >
                <Field label="Refund policy link">
                  <Input
                    type="url"
                    value={refundPolicyUrl}
                    onChange={(e) => setRefundPolicyUrl(e.target.value)}
                    placeholder="https://yoursite.com/refund-policy"
                    className={readOnlyTextClass}
                    readOnly={submitted}
                  />
                </Field>
                <Field label="Terms of service link">
                  <Input
                    type="url"
                    value={termsUrl}
                    onChange={(e) => setTermsUrl(e.target.value)}
                    placeholder="https://yoursite.com/terms"
                    className={readOnlyTextClass}
                    readOnly={submitted}
                  />
                </Field>
              </Box>

              <Text variant="caption" color="muted">
                Countering a chargeback incurs an automatic fee.{' '}
                <a
                  href={CHARGEBACK_FEES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Read more about chargeback fees
                </a>
                .
              </Text>
            </>
          )}

          {!submitted && (
            <Box justifyContent="end">
              <Button
                type="button"
                loading={submitting}
                disabled={!canSubmit}
                onClick={onSubmit}
              >
                {decision === 'counter' ? 'Submit evidence' : 'Accept dispute'}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </>
  )
}
