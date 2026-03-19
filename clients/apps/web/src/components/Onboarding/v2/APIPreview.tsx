/* eslint-disable max-lines */
'use client'

import { type schemas } from '@polar-sh/client'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useOnboardingData, useOnboardingDataLive } from './OnboardingContext'

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

const STEP_CONFIG = {
  personal: { method: 'PATCH', path: '/v1/users/me' },
  business: { method: 'POST', path: '/v1/organizations' },
  product: { method: 'PATCH', path: '/v1/organizations/:id' },
} as const

interface Line {
  key: string
  fingerprint: string
  indent: number
  content: React.ReactNode
}

export function APIPreview({
  step,
}: {
  step: 'personal' | 'business' | 'product'
}) {
  const data = useOnboardingDataLive()
  const { apiResponse } = useOnboardingData()

  const body = useMemo(() => {
    switch (step) {
      case 'personal': {
        const obj: Partial<schemas['UserUpdate']> = {}
        if (data.firstName) obj.first_name = data.firstName
        if (data.lastName) obj.last_name = data.lastName
        if (data.country)
          obj.country = data.country as schemas['UserUpdate']['country']
        if (data.dateOfBirth) obj.date_of_birth = data.dateOfBirth
        return obj
      }
      case 'business': {
        const obj: Partial<schemas['OrganizationCreate']> = {
          default_presentment_currency:
            (data.defaultCurrency as schemas['PresentmentCurrency']) || 'usd',
        }
        if (data.orgName) obj.name = data.orgName
        if (data.orgSlug) obj.slug = data.orgSlug
        if (data.businessCountry)
          obj.country =
            data.businessCountry as schemas['OrganizationCreate']['country']
        const legalEntity: schemas['OrganizationCreate']['legal_entity'] =
          data.organizationType === 'company' && data.registeredBusinessName
            ? {
                type: 'company' as const,
                registered_name: data.registeredBusinessName,
              }
            : { type: 'individual' as const }
        obj.legal_entity = legalEntity
        return obj
      }
      case 'product': {
        const obj: Record<string, unknown> = {}
        if (data.supportEmail) obj.email = data.supportEmail
        if (data.productUrl) obj.website = data.productUrl

        const product: Record<string, unknown> = {}
        if (data.sellingCategories?.length)
          product.type = data.sellingCategories.map(toSnakeCase)
        if (data.pricingModel?.length)
          product.model = data.pricingModel.map(toSnakeCase)
        if (data.productDescription)
          product.description = data.productDescription
        if (Object.keys(product).length > 0) obj.product = product

        const switching = (data.currentlySellingOn?.length ?? 0) > 0
        if (switching) {
          obj.switching = true
          obj.switching_from = data
            .currentlySellingOn![0] as schemas['OrganizationDetails']['switching_from']
        }
        return obj
      }
    }
  }, [step, data])

  const { method, path } = STEP_CONFIG[step]
  const lines = useMemo(() => buildLines(body), [body])
  const contentLength = useMemo(
    () => new TextEncoder().encode(JSON.stringify(body, null, 2)).length,
    [body],
  )

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

    const next = new Map<string, string>()
    for (const line of lines) {
      next.set(line.key, line.fingerprint)
    }
    prevFingerprints.current = next

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

  const methodColor =
    method === 'POST'
      ? 'text-green-600 dark:text-green-500'
      : 'text-amber-600 dark:text-amber-500'

  return (
    <div className="flex flex-col font-mono text-[11px]">
      <div className="flex flex-col gap-1.5 border-b border-gray-200 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${methodColor}`}>{method}</span>
          <span className="text-gray-400 dark:text-gray-600">{path}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-[10px] text-gray-400 dark:text-gray-600">
          <span>Host: api.polar.sh</span>
          <span>Content-Type: application/json</span>
          <span>Content-Length: {contentLength}</span>
          <span>Authorization: Bearer polar_sk_Yj1mbihldmVudHMp</span>
        </div>
      </div>

      <div className="pt-3 pb-2 text-[10px] font-medium tracking-wider text-gray-400 uppercase dark:text-gray-600">
        Request Body
      </div>

      <div className="flex flex-col font-mono">
        {lines.map((line, i) => {
          const isFlashed = flashedKeys.has(line.key)
          return (
            <div key={line.key} className="flex leading-relaxed">
              <span
                className="mr-3 shrink-0 text-right text-gray-300 select-none dark:text-gray-700"
                style={{ minWidth: '1.5ch' }}
              >
                {i + 1}
              </span>
              <span
                className="flex-1 leading-relaxed break-words"
                style={{ paddingLeft: `${line.indent}ch` }}
              >
                <span
                  className={`-mx-1 rounded px-1 transition-colors duration-500 ${
                    isFlashed
                      ? 'bg-blue-500/15 dark:bg-blue-400/10'
                      : 'bg-transparent'
                  }`}
                >
                  {line.content}
                </span>
              </span>
            </div>
          )
        })}
      </div>

      {apiResponse && (
        <div className="mt-3 flex flex-col gap-3 border-t border-gray-200 pt-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                apiResponse.status >= 400
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}
            >
              {apiResponse.status}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-500">
              {apiResponse.message}
            </span>
          </div>

          <div className="pb-2 text-[10px] font-medium tracking-wider text-gray-400 uppercase dark:text-gray-600">
            Response Body
          </div>
          <pre className="leading-relaxed text-gray-500 dark:text-gray-500">
            {'{\n'}
            {'  '}
            <span className="text-blue-600 dark:text-blue-400">{'"id"'}</span>
            <span className="text-gray-400">: </span>
            <span className="text-green-600 dark:text-green-400">
              {'"org_•••"'}
            </span>
            {',\n'}
            {'  '}
            <span className="text-blue-600 dark:text-blue-400">
              {'"created_at"'}
            </span>
            <span className="text-gray-400">: </span>
            <span className="text-green-600 dark:text-green-400">{`"${new Date().toISOString().split('.')[0]}Z"`}</span>
            {'\n}'}
          </pre>
        </div>
      )}
    </div>
  )
}

function buildLines(
  obj: Record<string, unknown>,
  prefix = '',
  indent = 2,
): Line[] {
  const entries = Object.entries(obj)
  const keyPrefix = prefix ? `${prefix}.` : ''

  if (entries.length === 0 && indent === 2) {
    return [
      {
        key: 'empty',
        fingerprint: '{}',
        indent: 0,
        content: (
          <span className="text-gray-400 dark:text-gray-500">{'{ }'}</span>
        ),
      },
    ]
  }

  const lines: Line[] = []

  if (indent === 2) {
    lines.push({
      key: '__open',
      fingerprint: '{',
      indent: 0,
      content: <span className="text-gray-400">{'{'}</span>,
    })
  }

  entries.forEach(([key, value], i) => {
    const comma = i < entries.length - 1
    const fullKey = `${keyPrefix}${key}`

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      lines.push({
        key: `${fullKey}-open`,
        fingerprint: `${fullKey}:{`,
        indent,
        content: (
          <span>
            <span className="text-blue-600 dark:text-blue-400">{`"${key}"`}</span>
            <span className="text-gray-400">{': {'}</span>
          </span>
        ),
      })
      lines.push(
        ...buildLines(value as Record<string, unknown>, fullKey, indent + 2),
      )
      lines.push({
        key: `${fullKey}-close`,
        fingerprint: `${fullKey}:}${comma ? ',' : ''}`,
        indent,
        content: (
          <span className="text-gray-400">
            {'}'}
            {comma && ','}
          </span>
        ),
      })
    } else if (Array.isArray(value) && value.length > 0) {
      lines.push({
        key: `${fullKey}-open`,
        fingerprint: `${fullKey}:[`,
        indent,
        content: (
          <span>
            <span className="text-blue-600 dark:text-blue-400">{`"${key}"`}</span>
            <span className="text-gray-400">{': ['}</span>
          </span>
        ),
      })
      value.forEach((item, j) => {
        const itemStr = JSON.stringify(item)
        lines.push({
          key: `${fullKey}-${j}`,
          fingerprint: `${fullKey}-${j}:${itemStr}`,
          indent: indent + 2,
          content: (
            <span>
              <JsonValue value={item} />
              {j < value.length - 1 && <span className="text-gray-400">,</span>}
            </span>
          ),
        })
      })
      lines.push({
        key: `${fullKey}-close`,
        fingerprint: `${fullKey}:]${comma ? ',' : ''}`,
        indent,
        content: (
          <span className="text-gray-400">
            {']'}
            {comma && ','}
          </span>
        ),
      })
    } else {
      const valStr = JSON.stringify(value)
      lines.push({
        key: fullKey,
        fingerprint: `${fullKey}:${valStr}`,
        indent,
        content: (
          <span>
            <span className="text-blue-600 dark:text-blue-400">{`"${key}"`}</span>
            <span className="text-gray-400">: </span>
            <JsonValue value={value} />
            {comma && <span className="text-gray-400">,</span>}
          </span>
        ),
      })
    }
  })

  if (indent === 2) {
    lines.push({
      key: '__close',
      fingerprint: '}',
      indent: 0,
      content: <span className="text-gray-400">{'}'}</span>,
    })
  }

  return lines
}

function JsonValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return (
      <span className="text-green-600 dark:text-green-400">{`"${value}"`}</span>
    )
  }
  if (typeof value === 'boolean') {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        {String(value)}
      </span>
    )
  }
  if (typeof value === 'number') {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        {String(value)}
      </span>
    )
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">[]</span>
    return null
  }
  return <span className="text-gray-400">null</span>
}
