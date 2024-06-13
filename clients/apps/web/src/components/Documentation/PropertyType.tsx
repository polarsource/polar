import { OpenAPIV3_1 } from 'openapi-types'
import React, { PropsWithChildren } from 'react'
import { getUnionSchemas, isSchemaObject } from './openapi'

const getTypeDisplayName = (property: OpenAPIV3_1.SchemaObject): string => {
  if (property.const) {
    return `"${property.const}"`
  }

  if (property.type === 'string') {
    if (property.enum) {
      return property.enum.map((e) => `"${e}"`).join(' | ')
    }
    // TODO: handle format
    // Ref: https://swagger.io/docs/specification/data-models/data-types/
    return 'string'
  }

  if (property.type === 'number') {
    return 'number'
  }

  if (property.type === 'integer') {
    return 'integer'
  }

  if (property.type === 'boolean') {
    return 'boolean'
  }

  if (property.type === 'null') {
    return 'null'
  }

  if (property.type === 'object') {
    return property.title || 'object'
  }

  if (property.type === 'array') {
    return 'array'
  }

  return 'NOT_IMPLEMENTED'
}

const ScalarPropertyWrapper = ({ children }: React.PropsWithChildren) => {
  return (
    <span className="text-xxs rounded-md bg-blue-50 px-2 py-1 font-mono font-normal text-blue-500 dark:bg-blue-950/50">
      {children}
    </span>
  )
}

const PropertyType = ({
  property,
  Wrapper = ScalarPropertyWrapper,
}: {
  property: OpenAPIV3_1.SchemaObject
  Wrapper?: React.FC<PropsWithChildren>
}) => {
  const unionSchemas = getUnionSchemas(property)
  if (unionSchemas) {
    return (
      <div className="inline-flex flex-row items-center gap-x-1">
        {unionSchemas.filter(isSchemaObject).map((type, index) => (
          <>
            <PropertyType key={type.title} property={type} Wrapper={Wrapper} />
            {index < unionSchemas.length - 1 && (
              <span className="text-xxs font-mono text-gray-400 dark:text-gray-600">
                |
              </span>
            )}
          </>
        ))}
      </div>
    )
  }

  if (property.type === 'array' && isSchemaObject(property.items)) {
    return (
      <div className="inline-flex flex-row items-center">
        <span className="text-xxs rounded-md bg-blue-50 px-2 py-1 font-mono font-normal text-blue-500 dark:bg-blue-950/50">
          (
          <PropertyType
            property={property.items}
            Wrapper={({ children }) => <>{children}</>}
          />
          )[]
        </span>
      </div>
    )
  }

  return <Wrapper>{getTypeDisplayName(property)}</Wrapper>
}
export default PropertyType
