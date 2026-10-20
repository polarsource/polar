'use client'

import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'

interface FieldProps {
  label: string
  htmlFor: string
  children: React.ReactNode
}

const Field = ({ label, htmlFor, children }: FieldProps) => (
  <Box flexDirection="column" rowGap="s">
    <Text as="label" htmlFor={htmlFor}>
      {label}
    </Text>
    {children}
  </Box>
)

interface FormState {
  startupName: string
  website: string
  email: string
  linkedin: string
}

const INITIAL: FormState = {
  startupName: '',
  website: '',
  email: '',
  linkedin: '',
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

export const DesignPartnerForm = ({
  submitLabel = 'Become a design partner',
}: {
  submitLabel?: string
}) => {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<SubmitStatus>('idle')

  const set = (key: keyof FormState) => (value: string) =>
    setForm((s) => ({ ...s, [key]: value }))

  return (
    <Box
      as="form"
      flexDirection="column"
      rowGap="l"
      padding={{
        base: 'xl',
        md: '3xl',
      }}
      backgroundColor="background-secondary"
      onSubmit={async (e) => {
        e.preventDefault()
        setStatus('submitting')
        try {
          const res = await fetch('/api/design-partner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
          if (!res.ok) throw new Error(`Request failed: ${res.status}`)
          setStatus('success')
          setForm(INITIAL)
        } catch (err) {
          console.error('Design partner submission failed:', err)
          setStatus('error')
        }
      }}
    >
      <Field label="Company Name" htmlFor="startupName">
        <Input
          id="startupName"
          value={form.startupName}
          onChange={(e) => set('startupName')(e.target.value)}
          placeholder="Acme, Inc"
          required
        />
      </Field>

      <Field label="Website URL" htmlFor="website">
        <Input
          id="website"
          type="url"
          value={form.website}
          onChange={(e) => set('website')(e.target.value)}
          placeholder="https://yourcompany.com"
          required
        />
      </Field>

      <Field label="Contact Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
          placeholder="you@company.com"
          required
        />
      </Field>

      <Field label="Contact LinkedIn" htmlFor="linkedin">
        <Input
          id="linkedin"
          type="url"
          value={form.linkedin}
          onChange={(e) => set('linkedin')(e.target.value)}
          placeholder="https://linkedin.com/in/janedoe"
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={status === 'submitting'}
        disabled={status === 'submitting' || status === 'success'}
        className="my-8"
      >
        {status === 'success' ? 'Application Sent' : submitLabel}
      </Button>
      {status === 'error' && (
        <Text variant="caption" color="danger">
          Something went wrong. Please try again or email us directly.
        </Text>
      )}
    </Box>
  )
}
