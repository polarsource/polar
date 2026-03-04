'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useOnboardingData } from './OnboardingContext'

const ENDPOINT_MAP = {
  personal: '/v1/organizations',
  business: '/v1/organizations',
  product: '/v1/products',
} as const

interface Line {
  key: string
  fingerprint: string
  content: React.ReactNode
}

export function APIPreview({ step }: { step: 'personal' | 'business' | 'product' }) {
  const { data, apiResponse } = useOnboardingData()

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

  // Track which lines changed to flash them (debounced so typing doesn't perma-highlight)
  const prevFingerprints = useRef<Map<string, string>>(new Map())
  const [flashedKeys, setFlashedKeys] = useState<Set<string>>(new Set())
  const pendingChanges = useRef<Set<string>>(new Set())
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const prev = prevFingerprints.current

    for (const line of lines) {
      const old = prev.get(line.key)
      if (old !== undefined && old !== line.fingerprint) {
        pendingChanges.current.add(line.key)
      }
    }

    // Update stored fingerprints
    const next = new Map<string, string>()
    for (const line of lines) {
      next.set(line.key, line.fingerprint)
    }
    prevFingerprints.current = next

    // Debounce: wait for typing to pause before flashing
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (pendingChanges.current.size > 0) {
        setFlashedKeys(new Set(pendingChanges.current))
        pendingChanges.current.clear()
        clearTimeout(fadeTimer.current)
        fadeTimer.current = setTimeout(() => setFlashedKeys(new Set()), 800)
      }
    }, 300)

    return () => {
      clearTimeout(debounceTimer.current)
      clearTimeout(fadeTimer.current)
    }
  }, [lines])

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
          {lines.map((line, i) => {
            const isFlashed = flashedKeys.has(line.key)
            return (
              <span key={line.key}>
                <span
                  className={`-mx-1 rounded px-1 transition-colors duration-500 ${
                    isFlashed
                      ? 'bg-blue-500/15 dark:bg-blue-400/10'
                      : 'bg-transparent'
                  }`}
                >
                  {line.content}
                </span>
                {i < lines.length - 1 && '\n'}
              </span>
            )
          })}
        </pre>
      </div>

      {/* API Response */}
      {apiResponse && (
        <div className="mt-4 flex flex-col gap-2 border-t border-gray-200 pt-4 font-mono dark:border-gray-800">
          <span className="text-[11px] font-semibold text-green-600 dark:text-green-500">
            {apiResponse.status} {apiResponse.message}
          </span>
          <div className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div className="h-full animate-pulse rounded-full bg-green-500" style={{ width: '100%' }} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Convert the object into an array of keyed lines with fingerprints for change detection. */
function buildLines(obj: Record<string, unknown>): Line[] {
  const entries = Object.entries(obj)
  if (entries.length === 0) {
    return [{
      key: 'empty',
      fingerprint: '{}',
      content: <span className="text-gray-400 dark:text-gray-500">{'{ }'}</span>,
    }]
  }

  const lines: Line[] = []
  lines.push({
    key: '__open',
    fingerprint: '{',
    content: <span className="text-gray-400">{'{'}</span>,
  })

  entries.forEach(([key, value], i) => {
    const comma = i < entries.length - 1
    if (Array.isArray(value) && value.length > 0) {
      lines.push({
        key: `${key}-open`,
        fingerprint: `${key}:[`,
        content: (
          <span>
            {'  '}
            <span className="text-blue-600 dark:text-blue-400">{`"${key}"`}</span>
            <span className="text-gray-400">{': ['}</span>
          </span>
        ),
      })
      value.forEach((item, j) => {
        const itemStr = JSON.stringify(item)
        lines.push({
          key: `${key}-${j}`,
          fingerprint: `${key}-${j}:${itemStr}`,
          content: (
            <span>
              {'    '}
              <JsonValue value={item} />
              {j < value.length - 1 && <span className="text-gray-400">,</span>}
            </span>
          ),
        })
      })
      lines.push({
        key: `${key}-close`,
        fingerprint: `${key}:]${comma ? ',' : ''}`,
        content: (
          <span>
            {'  '}
            <span className="text-gray-400">{']'}{comma && ','}</span>
          </span>
        ),
      })
    } else {
      const valStr = JSON.stringify(value)
      lines.push({
        key,
        fingerprint: `${key}:${valStr}`,
        content: (
          <span>
            {'  '}
            <span className="text-blue-600 dark:text-blue-400">{`"${key}"`}</span>
            <span className="text-gray-400">: </span>
            <JsonValue value={value} />
            {comma && <span className="text-gray-400">,</span>}
          </span>
        ),
      })
    }
  })

  lines.push({
    key: '__close',
    fingerprint: '}',
    content: <span className="text-gray-400">{'}'}</span>,
  })
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
