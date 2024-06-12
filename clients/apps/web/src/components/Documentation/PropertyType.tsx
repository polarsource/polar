import { OpenAPIV3_1 } from 'openapi-types'
import { getUnionSchemas, isSchemaObject } from './utils'

const getTypeDisplayName = (property: OpenAPIV3_1.SchemaObject): string => {
  if (property.const) {
    return `"${property.const}"`
  }

  if (property.type === 'string') {
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
    return 'object'
  }

  if (property.type === 'array') {
    if (isSchemaObject(property.items)) {
      return `${getTypeDisplayName(property.items)}[]`
    }
    return 'array'
  }

  return 'NOT_IMPLEMENTED'
}

const PropertyScalarType = ({
  property,
}: {
  property: OpenAPIV3_1.SchemaObject
}) => {
  const displayName = getTypeDisplayName(property)
  return (
    <span className="text-xxs rounded-md bg-blue-50 px-2 py-1 font-mono font-normal text-blue-500 dark:bg-blue-950/50">
      {displayName}
    </span>
  )
}

const PropertyType = ({ property }: { property: OpenAPIV3_1.SchemaObject }) => {
  const unionSchemas = getUnionSchemas(property)
  if (unionSchemas) {
    return (
      <div className="flex flex-row items-center gap-x-1">
        {unionSchemas.filter(isSchemaObject).map((type, index) => (
          <>
            <PropertyType key={type.title} property={type} />
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
  return <PropertyScalarType property={property} />
}
export default PropertyType
