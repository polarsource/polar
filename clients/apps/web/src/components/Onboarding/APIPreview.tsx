'use client'

import { type schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
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
  product: { method: 'POST', path: '/v1/organizations' },
  sandbox: { method: 'POST', path: '/v1/organizations' },
} as const

interface Line {
  key: string
  fingerprint: string
  indent: number
  content: React.ReactNode
}

export type APIPreviewStep = 'personal' | 'business' | 'product' | 'sandbox'

export function APIPreview({ step }: { step: APIPreviewStep }) {
  const data = useOnboardingDataLive()
  const { apiLoading, apiResponse, clearApiResponse } = useOnboardingData()

  useEffect(() => {
    clearApiResponse()
  }, [step, clearApiResponse])

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
      case 'sandbox': {
        const sandboxObj: Partial<schemas['OrganizationCreate']> = {
          default_presentment_currency:
            (data.defaultCurrency as schemas['PresentmentCurrency']) || 'usd',
        }
        if (data.orgName) sandboxObj.name = data.orgName
        if (data.orgSlug) sandboxObj.slug = data.orgSlug
        return sandboxObj
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
        const obj: Record<string, unknown> = {
          default_presentment_currency: data.defaultCurrency || 'usd',
        }
        if (data.orgName) obj.name = data.orgName
        if (data.orgSlug) obj.slug = data.orgSlug
        if (data.businessCountry) obj.country = data.businessCountry
        const legalEntity =
          data.organizationType === 'company' && data.registeredBusinessName
            ? {
                type: 'company' as const,
                registered_name: data.registeredBusinessName,
              }
            : { type: 'individual' as const }
        obj.legal_entity = legalEntity
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
    }
  }, [lines])

  const methodColor =
    method === 'POST'
      ? 'text-green-600 dark:text-green-500'
      : 'text-amber-600 dark:text-amber-500'

  return (
    <Box display="flex" flexDirection="column">
      <Box
        display="flex"
        flexDirection="column"
        rowGap="xs"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        paddingBottom="m"
      >
        <Box display="flex" alignItems="center" gap="s">
          <p
            className={`font-mono text-[11px] leading-relaxed font-semibold ${methodColor}`}
          >
            {method}
          </p>
          <p className="font-mono text-[11px] leading-relaxed text-gray-400 dark:text-gray-600">
            {path}
          </p>
        </Box>
        <Box display="flex" flexDirection="column">
          <p className="font-mono text-[10px] leading-relaxed text-gray-400 dark:text-gray-600">
            Host: api.polar.sh
          </p>
          <p className="font-mono text-[10px] leading-relaxed text-gray-400 dark:text-gray-600">
            Content-Type: application/json
          </p>
          <p className="font-mono text-[10px] leading-relaxed text-gray-400 dark:text-gray-600">
            Content-Length: {contentLength}
          </p>
          <p className="font-mono text-[10px] leading-relaxed text-gray-400 dark:text-gray-600">
            Authorization: Bearer polar_sk_Yj1mbihldmVudHMp
          </p>
        </Box>
      </Box>

      <p className="pt-3 pb-2 font-mono text-[10px] leading-relaxed font-medium tracking-wider text-gray-400 uppercase dark:text-gray-600">
        Request Body
      </p>

      <Box display="flex" flexDirection="column">
        {lines.map((line, i) => {
          const isFlashed = flashedKeys.has(line.key)
          return (
            <Box key={line.key} display="flex">
              <p
                className="mr-3 shrink-0 text-right font-mono text-[11px] leading-relaxed text-gray-300 select-none dark:text-gray-700"
                style={{ minWidth: '1.5ch' }}
              >
                {i + 1}
              </p>
              <code
                className="flex-1 font-mono text-[11px] leading-relaxed break-words"
                style={{ paddingLeft: `${line.indent}ch` }}
              >
                <code
                  className={`-mx-1 rounded px-1 transition-colors duration-500 ${
                    isFlashed
                      ? 'bg-blue-500/15 dark:bg-blue-400/10'
                      : 'bg-transparent'
                  }`}
                >
                  {line.content}
                </code>
              </code>
            </Box>
          )
        })}
      </Box>

      {apiLoading && (
        <Box
          marginTop="m"
          display="flex"
          alignItems="center"
          gap="s"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          paddingTop="m"
        >
          <Box height={6} width={6} borderRadius="full" />
          <p className="font-mono text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
            Sending request...
          </p>
        </Box>
      )}

      {apiResponse && (
        <Box
          marginTop="m"
          display="flex"
          flexDirection="column"
          rowGap="m"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          paddingTop="m"
        >
          <Box display="flex" alignItems="center" gap="s">
            <p
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] leading-relaxed font-bold ${
                apiResponse.status >= 400
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}
            >
              {apiResponse.status}
            </p>
            <p className="font-mono text-[10px] leading-relaxed text-gray-500 dark:text-gray-500">
              {apiResponse.message}
            </p>
          </Box>

          {apiResponse.status < 400 && (
            <>
              <p className="pb-2 font-mono text-[10px] leading-relaxed font-medium tracking-wider text-gray-400 uppercase dark:text-gray-600">
                Response Body
              </p>
              <pre className="font-mono text-[11px] leading-relaxed text-gray-500 dark:text-gray-500">
                {'{\n'}
                {'  '}
                <code className="text-blue-600 dark:text-blue-400">
                  {'"id"'}
                </code>
                <code className="text-gray-400">: </code>
                <code className="text-green-600 dark:text-green-400">
                  {'"org_•••"'}
                </code>
                {',\n'}
                {'  '}
                <code className="text-blue-600 dark:text-blue-400">
                  {'"created_at"'}
                </code>
                <code className="text-gray-400">: </code>
                <code className="text-green-600 dark:text-green-400">{`"${new Date().toISOString().split('.')[0]}Z"`}</code>
                {'\n}'}
              </pre>
            </>
          )}
        </Box>
      )}
    </Box>
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
        content: <code className="text-gray-400">{'{ }'}</code>,
      },
    ]
  }

  const lines: Line[] = []

  if (indent === 2) {
    lines.push({
      key: '__open',
      fingerprint: '{',
      indent: 0,
      content: <code className="text-gray-400">{'{'}</code>,
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
          <>
            <code className="text-blue-600 dark:text-blue-400">{`"${key}"`}</code>
            <code className="text-gray-400">{': {'}</code>
          </>
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
          <code className="text-gray-400">
            {'}'}
            {comma && ','}
          </code>
        ),
      })
    } else if (Array.isArray(value) && value.length > 0) {
      lines.push({
        key: `${fullKey}-open`,
        fingerprint: `${fullKey}:[`,
        indent,
        content: (
          <>
            <code className="text-blue-600 dark:text-blue-400">{`"${key}"`}</code>
            <code className="text-gray-400">{': ['}</code>
          </>
        ),
      })
      value.forEach((item, j) => {
        const itemStr = JSON.stringify(item)
        lines.push({
          key: `${fullKey}-${j}`,
          fingerprint: `${fullKey}-${j}:${itemStr}`,
          indent: indent + 2,
          content: (
            <>
              <JsonValue value={item} />
              {j < value.length - 1 && <code className="text-gray-400">,</code>}
            </>
          ),
        })
      })
      lines.push({
        key: `${fullKey}-close`,
        fingerprint: `${fullKey}:]${comma ? ',' : ''}`,
        indent,
        content: (
          <code className="text-gray-400">
            {']'}
            {comma && ','}
          </code>
        ),
      })
    } else {
      const valStr = JSON.stringify(value)
      lines.push({
        key: fullKey,
        fingerprint: `${fullKey}:${valStr}`,
        indent,
        content: (
          <>
            <code className="text-blue-600 dark:text-blue-400">{`"${key}"`}</code>
            <code className="text-gray-400">: </code>
            <JsonValue value={value} />
            {comma && <code className="text-gray-400">,</code>}
          </>
        ),
      })
    }
  })

  if (indent === 2) {
    lines.push({
      key: '__close',
      fingerprint: '}',
      indent: 0,
      content: <code className="text-gray-400">{'}'}</code>,
    })
  }

  return lines
}

function JsonValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return (
      <code className="text-green-600 dark:text-green-400">{`"${value}"`}</code>
    )
  }
  if (typeof value === 'boolean') {
    return (
      <code className="text-amber-600 dark:text-amber-400">
        {String(value)}
      </code>
    )
  }
  if (typeof value === 'number') {
    return (
      <code className="text-amber-600 dark:text-amber-400">
        {String(value)}
      </code>
    )
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <code className="text-gray-400">[]</code>
    return null
  }
  return <code className="text-gray-400">null</code>
}
