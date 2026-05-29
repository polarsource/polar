'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { useState } from 'react'

const FUNDING_OPTIONS = [
  'Bootstrapped',
  'Pre-seed',
  '$1M to $5M',
  '$5M to $15M',
  '$15M+',
]

const TEAM_SIZE_OPTIONS = ['1', '2 to 5', '6 to 15', '16 to 50', '50+']

const BILLING_PLATFORM_OPTIONS = [
  'None',
  'Polar',
  'Stripe',
  'Paddle',
  'Lemon Squeezy',
  'Other',
]

const PARTNER_OPTIONS = [
  'Accel',
  'Andreessen Horowitz',
  'Atomico',
  'Balderton',
  'Benchmark',
  'Bessemer Venture Partners',
  'Creandum',
  'First Round Capital',
  'Founders Fund',
  'General Catalyst',
  'Greylock',
  'Index Ventures',
  'Kleiner Perkins',
  'Lightspeed Venture Partners',
  'NEA',
  'Sequoia Capital',
  'Tiger Global',
  'Y Combinator',
  'Other',
]

interface FieldProps {
  label: string
  htmlFor: string
  children: React.ReactNode
}

const Field = ({ label, htmlFor, children }: FieldProps) => (
  <Box display="flex" flexDirection="column" rowGap="s">
    <Text as="label" htmlFor={htmlFor}>
      {label}
    </Text>
    {children}
  </Box>
)

interface FormState {
  startupName: string
  industry: string
  website: string
  foundedAt: string
  funding: string
  partner: string
  partnerOther: string
  paymentVolume: string
  currentBillingPlatform: string
  currentBillingPlatformOther: string
  polarOrgSlug: string
  teamSize: string
  location: string
  pitch: string
  firstName: string
  lastName: string
  role: string
  email: string
}

const INITIAL: FormState = {
  startupName: '',
  industry: '',
  website: '',
  foundedAt: '',
  funding: '',
  partner: '',
  partnerOther: '',
  paymentVolume: '',
  currentBillingPlatform: 'Polar',
  currentBillingPlatformOther: '',
  polarOrgSlug: '',
  teamSize: '',
  location: '',
  pitch: '',
  firstName: '',
  lastName: '',
  role: '',
  email: '',
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

export const StartupProgramForm = () => {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<SubmitStatus>('idle')

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((s) => ({ ...s, [key]: value }))

  return (
    <Box
      as="form"
      display="flex"
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
          const res = await fetch('/api/startup-program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
          if (!res.ok) throw new Error(`Request failed: ${res.status}`)
          setStatus('success')
          setForm(INITIAL)
        } catch (err) {
          console.error('Startup program submission failed:', err)
          setStatus('error')
        }
      }}
    >
      <Field label="Startup Name" htmlFor="startupName">
        <Input
          id="startupName"
          value={form.startupName}
          onChange={(e) => set('startupName')(e.target.value)}
          placeholder="Acme, Inc"
          required
        />
      </Field>

      <Field label="Industry" htmlFor="industry">
        <Input
          id="industry"
          value={form.industry}
          onChange={(e) => set('industry')(e.target.value)}
          placeholder="e.g. SaaS, Fintech, Healthcare"
        />
      </Field>

      <Field label="Website" htmlFor="website">
        <Input
          id="website"
          type="url"
          value={form.website}
          onChange={(e) => set('website')(e.target.value)}
          placeholder="https://yourcompany.com"
        />
      </Field>

      <Field label="When were you founded?" htmlFor="foundedAt">
        <Input
          id="foundedAt"
          value={form.foundedAt}
          onChange={(e) => set('foundedAt')(e.target.value)}
        />
      </Field>

      <Field label="Total Funding Raised" htmlFor="funding">
        <Select value={form.funding} onValueChange={set('funding')}>
          <SelectTrigger id="funding">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {FUNDING_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Partner / Investor" htmlFor="partner">
        <Select value={form.partner} onValueChange={set('partner')}>
          <SelectTrigger id="partner">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {PARTNER_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.partner === 'Other' && (
          <Input
            value={form.partnerOther}
            onChange={(e) => set('partnerOther')(e.target.value)}
            placeholder="Which partner?"
          />
        )}
      </Field>

      <Field label="Payment Volume (even if zero)" htmlFor="paymentVolume">
        <Input
          id="paymentVolume"
          value={form.paymentVolume}
          onChange={(e) => set('paymentVolume')(e.target.value)}
          placeholder="e.g. $0, $10K/mo, $100K/mo"
        />
      </Field>

      <Field label="Current Billing Platform" htmlFor="currentBillingPlatform">
        <Select
          value={form.currentBillingPlatform}
          onValueChange={set('currentBillingPlatform')}
        >
          <SelectTrigger id="currentBillingPlatform">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {BILLING_PLATFORM_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.currentBillingPlatform === 'Other' && (
          <Input
            value={form.currentBillingPlatformOther}
            onChange={(e) => set('currentBillingPlatformOther')(e.target.value)}
            placeholder="Which platform?"
          />
        )}
      </Field>

      {form.currentBillingPlatform === 'Polar' && (
        <Field label="Polar Organization Slug" htmlFor="polarOrgSlug">
          <Input
            id="polarOrgSlug"
            value={form.polarOrgSlug}
            onChange={(e) => set('polarOrgSlug')(e.target.value)}
            placeholder="acme-inc"
          />
        </Field>
      )}

      <Field label="Team Size" htmlFor="teamSize">
        <Select value={form.teamSize} onValueChange={set('teamSize')}>
          <SelectTrigger id="teamSize">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {TEAM_SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Main Location" htmlFor="location">
        <Input
          id="location"
          value={form.location}
          onChange={(e) => set('location')(e.target.value)}
          placeholder="e.g. San Francisco, CA"
        />
      </Field>

      <Field
        label="Your Pitch: what are you building? (100 words max)"
        htmlFor="pitch"
      >
        <TextArea
          id="pitch"
          rows={4}
          maxLength={800}
          value={form.pitch}
          onChange={(e) => set('pitch')(e.target.value)}
          placeholder="Tell us about your startup in a few sentences..."
        />
      </Field>

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
        gap="l"
      >
        <Field label="First Name" htmlFor="firstName">
          <Input
            id="firstName"
            value={form.firstName}
            onChange={(e) => set('firstName')(e.target.value)}
            placeholder="Jane"
            required
          />
        </Field>
        <Field label="Last Name" htmlFor="lastName">
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(e) => set('lastName')(e.target.value)}
            placeholder="Doe"
            required
          />
        </Field>
        <Field label="Role" htmlFor="role">
          <Input
            id="role"
            value={form.role}
            onChange={(e) => set('role')(e.target.value)}
            placeholder="e.g. CEO"
          />
        </Field>
      </Box>

      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
          placeholder="you@company.com"
          required
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
        {status === 'success' ? 'Application Sent' : 'Apply Now'}
      </Button>
      {status === 'error' && (
        <Text variant="caption" color="danger">
          Something went wrong. Please try again or email us directly.
        </Text>
      )}
    </Box>
  )
}
