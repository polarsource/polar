'use client'

import { useMemo } from 'react'
import { useOnboardingData } from './OnboardingContext'

const ENDPOINT_MAP = {
  personal: '/v1/organizations',
  business: '/v1/organizations',
  product: '/v1/products',
} as const

export function APIPreview({ step }: { step: 'personal' | 'business' | 'product' }) {
  const { data } = useOnboardingData()

  const body = useMemo(() => {
    switch (step) {
      case 'personal': {
        const obj: Record<string, unknown> = {}
        if (data.fullName) obj.name = data.fullName
        if (data.country) obj.country = data.country
        if (data.dateOfBirth) obj.date_of_birth = data.dateOfBirth
        return obj
      }
      case 'business': {
        const obj: Record<string, unknown> = {}
        if (data.orgName) obj.name = data.orgName
        if (data.orgSlug) obj.slug = data.orgSlug
        if (data.defaultCurrency) obj.default_currency = data.defaultCurrency
        if (data.organizationType) obj.organization_type = data.organizationType
        if (data.website) obj.website = data.website
        if (data.supportEmail) obj.support_email = data.supportEmail
        if (data.businessCountry) obj.country = data.businessCountry
        if (data.teamSize) obj.team_size = data.teamSize
        if (data.ventureBacked) obj.venture_backed = data.ventureBacked
        if (data.mainInvestor) obj.main_investor = data.mainInvestor
        return obj
      }
      case 'product': {
        const obj: Record<string, unknown> = {}
        if (data.sellingCategories?.length)
          obj.categories = data.sellingCategories
        if (data.productDescription) obj.description = data.productDescription
        if (data.pricingModel) obj.pricing_model = data.pricingModel
        if (data.meteredCredits) obj.metered_credits = data.meteredCredits
        if (data.currentlySellingOn?.length)
          obj.currently_selling_on = data.currentlySellingOn
        if (data.productWebsite) obj.website = data.productWebsite
        return obj
      }
    }
  }, [step, data])

  const endpoint = ENDPOINT_MAP[step]
  const lines = useMemo(() => buildLines(body), [body])

  return (
    <div className="flex flex-col gap-4 font-mono text-xs">
      <div className="inline-flex self-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-[11px] dark:border-gray-800 dark:bg-gray-900/50">
        <span className="font-semibold text-green-600 dark:text-green-500">POST</span>
        <span className="ml-1.5 text-gray-500 dark:text-gray-600">{endpoint}</span>
      </div>
      <div className="flex">
        {/* Line numbers */}
        <div className="mr-4 flex flex-col items-end select-none text-gray-300 dark:text-gray-700">
          {lines.map((_, i) => (
            <span key={i} className="leading-relaxed">{i + 1}</span>
          ))}
        </div>
        {/* Code */}
        <pre className="flex-1 leading-relaxed">
          {lines.map((line, i) => (
            <span key={i}>
              {line}
              {i < lines.length - 1 && '\n'}
            </span>
          ))}
        </pre>
      </div>
    </div>
  )
}

/** Convert the object into an array of JSX lines for line-numbering. */
function buildLines(obj: Record<string, unknown>): React.ReactNode[] {
  const entries = Object.entries(obj)
  if (entries.length === 0) {
    return [<span key="empty" className="text-gray-400 dark:text-gray-500">{'{ }'}</span>]
  }

  const lines: React.ReactNode[] = []
  lines.push(<span key="open" className="text-gray-400">{'{'}</span>)

  entries.forEach(([key, value], i) => {
    const comma = i < entries.length - 1
    if (Array.isArray(value) && value.length > 0) {
      // Array opening
      lines.push(
        <span key={`${key}-open`}>
          {'  '}
          <span className="text-blue-600 dark:text-blue-400">{`"${key}"`}</span>
          <span className="text-gray-400">{': ['}</span>
        </span>
      )
      // Array items
      value.forEach((item, j) => {
        lines.push(
          <span key={`${key}-${j}`}>
            {'    '}
            <JsonValue value={item} />
            {j < value.length - 1 && <span className="text-gray-400">,</span>}
          </span>
        )
      })
      // Array closing
      lines.push(
        <span key={`${key}-close`}>
          {'  '}
          <span className="text-gray-400">{']'}{comma && ','}</span>
        </span>
      )
    } else {
      lines.push(
        <span key={key}>
          {'  '}
          <span className="text-blue-600 dark:text-blue-400">{`"${key}"`}</span>
          <span className="text-gray-400">: </span>
          <JsonValue value={value} />
          {comma && <span className="text-gray-400">,</span>}
        </span>
      )
    }
  })

  lines.push(<span key="close" className="text-gray-400">{'}'}</span>)
  return lines
}

function JsonValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <span className="text-green-600 dark:text-green-400">{`"${value}"`}</span>
  }
  if (typeof value === 'boolean') {
    return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>
  }
  if (typeof value === 'number') {
    return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">[]</span>
    return null
  }
  return <span className="text-gray-400">null</span>
}
