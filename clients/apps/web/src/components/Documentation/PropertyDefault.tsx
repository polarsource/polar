import { OpenAPIV3_1 } from 'openapi-types'

const getDefaultDisplay = (
  property: OpenAPIV3_1.SchemaObject,
): string | null => {
  const { type, default: value } = property

  if (!value) {
    return null
  }

  if (!type) {
    return `${value}`
  }

  if (property.type === 'string') {
    return `"${value}"`
  }

  return `${value}`
}

const PropertyDefault = ({
  property,
}: {
  property: OpenAPIV3_1.SchemaObject
}) => {
  if (!property.default) {
    return null
  }

  return (
    <span className="text-xxs rounded-md bg-blue-50 px-2 py-1 font-mono font-normal text-blue-500 dark:bg-blue-950/50 dark:text-blue-300">
      Default: {getDefaultDisplay(property)}
    </span>
  )
}
export default PropertyDefault
