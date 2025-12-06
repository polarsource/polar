'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { ChevronDown } from 'lucide-react'
import React, { useMemo } from 'react'

export const HTTP_STATUS_CODES = [
  200, 201, 400, 401, 403, 404, 500, 502, 503,
] as const
type HttpStatusCode = (typeof HTTP_STATUS_CODES)[number]

export type WebhookStatusFilterValue = HttpStatusCode[]

interface WebhookStatusFilterProps {
  value: WebhookStatusFilterValue
  onChange: (value: WebhookStatusFilterValue) => void
}

const getStatusLabel = (code: HttpStatusCode): string => {
  const labels: Record<HttpStatusCode, string> = {
    200: '200 OK',
    201: '201 Created',
    400: '400 Bad Request',
    401: '401 Unauthorized',
    403: '403 Forbidden',
    404: '404 Not Found',
    500: '500 Internal Error',
    502: '502 Bad Gateway',
    503: '503 Unavailable',
  }
  return labels[code]
}

interface StatusCodeGroupProps {
  title: string
  codes: HttpStatusCode[]
  value: WebhookStatusFilterValue
  onToggle: (code: HttpStatusCode) => void
}

const StatusCodeGroup: React.FC<StatusCodeGroupProps> = ({
  title,
  codes,
  value,
  onToggle,
}) => {
  return (
    <div>
      <div className="px-2 py-1 text-xs font-medium text-gray-400">{title}</div>
      {codes.map((code) => (
        <label
          key={code}
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Checkbox
            checked={value.includes(code)}
            onCheckedChange={() => onToggle(code)}
          />
          <span className="text-sm">{getStatusLabel(code)}</span>
        </label>
      ))}
    </div>
  )
}

const WebhookStatusFilter: React.FC<WebhookStatusFilterProps> = ({
  value,
  onChange,
}) => {
  const allSelected = value.length === HTTP_STATUS_CODES.length

  const handleToggle = (code: HttpStatusCode) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code))
    } else {
      onChange([...value, code])
    }
  }

  const onToggleAll = () => {
    if (allSelected) {
      onChange([])
    } else {
      onChange([...HTTP_STATUS_CODES])
    }
  }

  const buttonLabel = useMemo(() => {
    if (value.length === 0) return 'All status codes'
    if (value.length === HTTP_STATUS_CODES.length) return 'All status codes'
    if (value.length === 1) return getStatusLabel(value[0])
    return `${value.length} status codes`
  }, [value])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="default"
          variant="outline"
          className="ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 dark:hover:border-polar-700 w-[175px] border-gray-200 bg-white shadow-xs hover:border-gray-300 hover:bg-white focus:outline-none [&>span]:line-clamp-1"
          wrapperClassNames="justify-between w-full"
        >
          <div className="truncate">{buttonLabel}</div>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Status Codes</span>
          <Button onClick={onToggleAll} variant="ghost" size="sm">
            {!allSelected ? 'Select All' : 'Unselect All'}
          </Button>
        </div>
        <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto p-2">
          <StatusCodeGroup
            title="Success"
            codes={HTTP_STATUS_CODES.filter(
              (code) => code >= 200 && code < 300,
            )}
            value={value}
            onToggle={handleToggle}
          />
          <StatusCodeGroup
            title="Client Error"
            codes={HTTP_STATUS_CODES.filter(
              (code) => code >= 400 && code < 500,
            )}
            value={value}
            onToggle={handleToggle}
          />
          <StatusCodeGroup
            title="Server Error"
            codes={HTTP_STATUS_CODES.filter((code) => code >= 500)}
            value={value}
            onToggle={handleToggle}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default WebhookStatusFilter
