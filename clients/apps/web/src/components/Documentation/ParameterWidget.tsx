'use client'

import { useAuth } from '@/hooks'
import { getServerURL } from '@/utils/api'
import { ClearOutlined } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import debounce from 'lodash.debounce'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { OpenAPIV3_1 } from 'openapi-types'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import { Input } from 'polarkit/components/ui/input'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SchemaObjectWithSelectorWidget,
  SelectorWidgetSchema,
  getParameterName,
  getUnionSchemas,
  hasSelectorWidget,
  isArraySchema,
  isDereferenced,
  resolveSchemaMinMax,
} from './openapi'

const useSelectorWidgetQuery = (
  widgetSchema: SelectorWidgetSchema,
  organization_id: string[],
) =>
  useQuery({
    queryKey: ['docs_selector_widget', { ...widgetSchema, organization_id }],
    queryFn: () => {
      const params = new URLSearchParams()
      // Special treatment for organizations widget itself: only show organizations the user is a member of
      if (widgetSchema.resourceRoot === '/v1/organizations') {
        params.append('is_member', 'true')
        // Otherwise, filter the resource by organization_id
      } else {
        organization_id.forEach((id) => params.append('organization_id', id))
      }

      return fetch(getServerURL(`${widgetSchema.resourceRoot}/?${params}`), {
        method: 'GET',
        credentials: 'include',
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unexpected ${response.status} status code`)
        }
        const json = await response.json()
        return json['items'] as any[]
      })
    },
    enabled: organization_id.length > 0,
  })

const SelectorWidgetItem = ({
  widgetSchema,
  item,
}: {
  widgetSchema: SelectorWidgetSchema
  item: any
}) => {
  return (
    <>
      {item[widgetSchema.displayProperty]}
      <span className="ml-2 font-mono text-gray-500">{item.id}</span>
    </>
  )
}

const SelectorWidget = ({
  schema,
  parameterName,
  parameterIn,
}: {
  schema: SchemaObjectWithSelectorWidget
  parameterName: string
  parameterIn: 'query' | 'path' | 'body'
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const widgetSchema = schema['x-polar-selector-widget']
  const parameterKey = getParameterName(parameterName, parameterIn)

  // Always limit results to organizations the user is a member of
  const { userOrganizations: organizations } = useAuth()
  const organization_ids = organizations.map((org) => org.id)
  const {
    data: items,
    isLoading,
    isPending,
  } = useSelectorWidgetQuery(widgetSchema, organization_ids)

  const parameterValue = useMemo(
    () => params.get(parameterKey) || '',
    [params, parameterKey],
  )

  const onChange = useCallback(
    (value: string) => {
      const updatedParams = new URLSearchParams(params)
      updatedParams.set(parameterKey, value)
      router.replace(`${pathname}?${updatedParams}`, { scroll: false })
    },
    [params, parameterKey, pathname, router],
  )

  return (
    <Select onValueChange={onChange} value={parameterValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {isLoading && (
            <SelectLabel>Loading {widgetSchema.resourceName}...</SelectLabel>
          )}
          {(isPending || (items && items.length === 0)) && (
            <SelectLabel>No {widgetSchema.resourceName} found</SelectLabel>
          )}
          {items &&
            items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <SelectorWidgetItem widgetSchema={widgetSchema} item={item} />
              </SelectItem>
            ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

const GenericWidget = ({
  schema,
  parameterName,
  parameterIn,
}: {
  schema: OpenAPIV3_1.SchemaObject
  parameterName: string
  parameterIn: 'query' | 'path' | 'body'
}) => {
  const parameterKey = getParameterName(parameterName, parameterIn)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [value, setValue] = useState<string>('')

  useEffect(() => {
    setValue(
      params.get(parameterKey) ||
        (schema.default !== undefined ? `${schema.default}` : ''),
    )
  }, [params, parameterKey, schema.default])

  const updateURL = useCallback(
    (value: string) => {
      const updatedParams = new URLSearchParams(params)
      updatedParams.set(parameterKey, value)
      router.replace(`${pathname}?${updatedParams}`, { scroll: false })
    },
    [params, router, pathname, parameterKey],
  )
  const debouncedUpdateURL = debounce(updateURL, 500)

  const onChange = useCallback(
    (value: string) => {
      setValue(value)
      updateURL(value)
    },
    [updateURL],
  )
  const debouncedOnChange = useCallback(
    (value: string) => {
      setValue(value)
      debouncedUpdateURL(value)
    },
    [debouncedUpdateURL],
  )

  if (schema.type === 'number' || schema.type === 'integer') {
    const [min, max] = resolveSchemaMinMax(schema)
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => debouncedOnChange(e.target.value)}
        min={min}
        max={max}
      />
    )
  }

  if (schema.type === 'boolean') {
    return (
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">
            <span className="font-mono">true</span>
          </SelectItem>
          <SelectItem value="false" className="font-mono">
            <span className="font-mono">false</span>
          </SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (schema.enum) {
    return (
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {schema.enum.map((value, index) => (
            <SelectItem key={index} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (schema.type === 'string') {
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => debouncedOnChange(e.target.value)}
      />
    )
  }

  if (schema.type === 'array' && isDereferenced(schema.items)) {
    return (
      <ParameterWidget
        schema={schema.items}
        parameterName={parameterName}
        parameterIn={parameterIn}
      />
    )
  }

  // TODO?: handle more types
  return null
}

const ClearParameterButton = ({
  parameterName,
  parameterIn,
}: {
  parameterName: string
  parameterIn: 'query' | 'path' | 'body'
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const parameterKey = getParameterName(parameterName, parameterIn)

  const onClick = useCallback(() => {
    const updatedParams = new URLSearchParams(params)
    updatedParams.delete(parameterKey)
    router.replace(`${pathname}?${updatedParams}`, { scroll: false })
  }, [params, parameterKey, pathname, router])

  if (!params.has(parameterKey)) {
    return null
  }

  return (
    <Button
      className={
        'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
      }
      size="icon"
      variant="secondary"
      type="button"
      onClick={onClick}
    >
      <ClearOutlined fontSize="inherit" />
    </Button>
  )
}

const UnionParameterWidget = ({
  schemas: _schemas,
  parameterName,
  parameterIn,
}: {
  schemas: OpenAPIV3_1.SchemaObject[]
  parameterName: string
  parameterIn: 'query' | 'path' | 'body'
}) => {
  const schemas = _schemas.filter(isDereferenced)
  const nullSchema = schemas.find((schema) => schema.type === 'null')
  const nonNullSchemas = schemas.filter((schema) => schema.type !== 'null')

  // For schemas that are like `uuid | uuid[]`, we don't want the widget twice
  // So we remove the array schema if there is a non-array schema with the same type
  const deduplicatedArraySchemas = nonNullSchemas.filter(
    (schema) =>
      !isArraySchema(schema) ||
      !nonNullSchemas.some(
        (s) => isDereferenced(schema.items) && s.type === schema.items.type,
      ),
  )

  return (
    <div className="flex flex-row items-center gap-2">
      {deduplicatedArraySchemas.map((schema, index) => (
        <ParameterWidget
          key={index}
          schema={schema}
          parameterName={parameterName}
          parameterIn={parameterIn}
        />
      ))}
      {nullSchema && (
        <ClearParameterButton
          parameterName={parameterName}
          parameterIn={parameterIn}
        />
      )}
    </div>
  )
}

const ParameterWidget = ({
  schema,
  parameterName,
  parameterIn,
}: {
  schema: OpenAPIV3_1.SchemaObject
  parameterName: string
  parameterIn: 'query' | 'path' | 'body'
}) => {
  const { currentUser } = useAuth()
  if (!currentUser) {
    return null
  }

  const unionSchemas = getUnionSchemas(schema)
  if (unionSchemas) {
    return (
      <UnionParameterWidget
        schemas={unionSchemas}
        parameterName={parameterName}
        parameterIn={parameterIn}
      />
    )
  }

  if (hasSelectorWidget(schema)) {
    return (
      <SelectorWidget
        schema={schema}
        parameterName={parameterName}
        parameterIn={parameterIn}
      />
    )
  }

  return (
    <GenericWidget
      schema={schema}
      parameterName={parameterName}
      parameterIn={parameterIn}
    />
  )
}

export default ParameterWidget
