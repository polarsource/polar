'use client'

import { useMemo } from 'react'
import { useOnboardingData } from './OnboardingContext'

const ENDPOINT_MAP = {
  personal: 'POST /v1/organizations',
  business: 'POST /v1/organizations',
  product: 'POST /v1/products',
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

  return (
    <div className="flex flex-col gap-4 font-mono text-sm">
      <div className="inline-flex self-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-600">
        {endpoint}
      </div>
      <pre className="leading-relaxed">
        <SyntaxHighlight obj={body} />
      </pre>
    </div>
  )
}

function SyntaxHighlight({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj)

  if (entries.length === 0) {
    return <span className="text-gray-400 dark:text-gray-500">{'{ }'}</span>
  }

  return (
    <>
      <span className="text-gray-400 dark:text-gray-400">{'{'}</span>
      {'\n'}
      {entries.map(([key, value], i) => (
        <span key={key}>
          {'  '}
          <span className="text-blue-600 dark:text-blue-400">{`"${key}"`}</span>
          <span className="text-gray-400">: </span>
          <JsonValue value={value} />
          {i < entries.length - 1 && <span className="text-gray-400">,</span>}
          {'\n'}
        </span>
      ))}
      <span className="text-gray-400">{'}'}</span>
    </>
  )
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
    return (
      <>
        <span className="text-gray-400">[</span>
        {value.map((item, i) => (
          <span key={i}>
            {'\n    '}
            <JsonValue value={item} />
            {i < value.length - 1 && <span className="text-gray-400">,</span>}
          </span>
        ))}
        {'\n  '}
        <span className="text-gray-400">]</span>
      </>
    )
  }
  return <span className="text-gray-400">null</span>
}
