'use client'

import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'

function JsonString({ value }: { value: string }) {
  return (
    <span className="text-green-600 dark:text-green-400">
      &quot;{value}&quot;
    </span>
  )
}

function JsonKey({ name }: { name: string }) {
  return (
    <span className="text-blue-600 dark:text-blue-400">&quot;{name}&quot;</span>
  )
}

function Punctuation({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-400">{children}</span>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SandboxAPIPreview({ control }: { control: any }) {
  const orgName = useWatch({ control, name: 'orgName' }) as string
  const orgSlug = useWatch({ control, name: 'orgSlug' }) as string
  const defaultCurrency = useWatch({
    control,
    name: 'defaultCurrency',
  }) as string

  const body = useMemo(
    () => ({
      name: orgName || '',
      slug: orgSlug || '',
      default_presentment_currency: defaultCurrency || 'usd',
      legal_entity: { type: 'individual' },
    }),
    [orgName, orgSlug, defaultCurrency],
  )

  const contentLength = useMemo(
    () => new TextEncoder().encode(JSON.stringify(body, null, 2)).length,
    [body],
  )

  return (
    <div className="flex flex-col font-mono text-[11px]">
      <div className="flex flex-col gap-1.5 border-b border-gray-200 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-green-600 dark:text-green-500">
            POST
          </span>
          <span className="text-gray-400 dark:text-gray-600">
            /v1/organizations
          </span>
        </div>
        <div className="flex flex-col gap-0.5 text-[10px] text-gray-400 dark:text-gray-600">
          <span>Host: sandbox-api.polar.sh</span>
          <span>Content-Type: application/json</span>
          <span>Content-Length: {contentLength}</span>
          <span>Authorization: Bearer polar_sk_Yj1mbihldmVudHMp</span>
        </div>
      </div>

      <div className="pt-3 pb-2 text-[10px] font-medium tracking-wider text-gray-400 uppercase dark:text-gray-600">
        Request Body
      </div>

      <div className="flex flex-col leading-relaxed">
        <Punctuation>{'{'}</Punctuation>
        <span className="pl-[2ch]">
          <JsonKey name="name" />
          <Punctuation>: </Punctuation>
          <JsonString value={orgName || ''} />
          <Punctuation>,</Punctuation>
        </span>
        <span className="pl-[2ch]">
          <JsonKey name="slug" />
          <Punctuation>: </Punctuation>
          <JsonString value={orgSlug || ''} />
          <Punctuation>,</Punctuation>
        </span>
        <span className="pl-[2ch]">
          <JsonKey name="default_presentment_currency" />
          <Punctuation>: </Punctuation>
          <JsonString value={defaultCurrency || 'usd'} />
          <Punctuation>,</Punctuation>
        </span>
        <Punctuation>{'}'}</Punctuation>
      </div>
    </div>
  )
}
