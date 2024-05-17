import { OpenAPIV3_1 } from 'openapi-types'
import { ParameterItem } from './ParameterItem'

export const BodyParameters = ({
  parameters,
}: {
  parameters: OpenAPIV3_1.SchemaObject
}) => {
  const requiredProperties = parameters.required ?? []
  const properties =
    'properties' in parameters
      ? Object.entries(parameters.properties ?? {}).sort(([keyA], [keyB]) =>
          requiredProperties.includes(keyA) ===
          requiredProperties.includes(keyB)
            ? 0
            : requiredProperties.includes(keyA)
              ? -1
              : 1,
        )
      : []

  return (
    <div className="flex flex-col gap-y-6">
      <h3 className="text-xl text-black dark:text-white">Body Parameters</h3>

      <div className="flex flex-col gap-y-4">
        {properties.map(
          ([key, property]: [
            key: string,
            property: OpenAPIV3_1.SchemaObject,
          ]) => (
            <ParameterItem key={key}>
              <div className="flex flex-row items-center gap-x-3">
                <span className="dark:text-polar-200 font-mono text-sm text-gray-700">
                  {key}
                </span>

                {requiredProperties.includes(key) && (
                  <span className="dark:bg-polar-700 text-xxs rounded-md bg-gray-100 px-2 py-1 font-mono font-normal capitalize">
                    Required
                  </span>
                )}
              </div>
              <span className="text-lg font-medium text-black dark:text-white">
                {property.title}
              </span>
              {property.description && (
                <p className="dark:text-polar-300 text-sm leading-normal text-gray-600">
                  {property.description}
                </p>
              )}
            </ParameterItem>
          ),
        )}
      </div>
    </div>
  )
}
