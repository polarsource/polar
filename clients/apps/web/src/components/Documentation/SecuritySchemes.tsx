import { OpenAPIV3_1 } from 'openapi-types'
import AnchoredElement from './AnchoredElement'

export const SecuritySchemes = ({
  operation,
}: {
  operation: OpenAPIV3_1.OperationObject
}) => {
  const scopes: string[] =
    operation.security?.find((security) => 'OpenIdConnect' in security)?.[
      'OpenIdConnect'
    ] || []

  if (scopes.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-6">
      <AnchoredElement id="scopes">
        <h3 className="group text-xl text-black dark:text-white">Scopes</h3>
      </AnchoredElement>

      <div className="flex flex-row gap-x-4">
        {scopes.map((scope) => (
          <div
            key={scope}
            className="text-xxs rounded-md bg-gray-50 px-2 py-1 font-mono font-normal text-gray-500 dark:bg-gray-950/50 dark:text-gray-400"
          >
            {scope}
          </div>
        ))}
      </div>
    </div>
  )
}
