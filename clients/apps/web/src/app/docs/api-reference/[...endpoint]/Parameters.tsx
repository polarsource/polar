import { OpenAPIV3_1 } from 'openapi-types'
import { ParameterItem } from './ParameterItem'

export const Parameters = ({
  parameters,
}: {
  parameters: OpenAPIV3_1.ParameterObject[]
}) => {
  return (
    <div className="flex flex-col gap-y-6">
      <h3 className="text-xl text-black dark:text-white">Parameters</h3>

      <div className="flex flex-col gap-y-4">
        {parameters.map((parameter, index) => (
          <ParameterItem key={index}>
            <div className="flex flex-row items-center gap-x-3">
              <span className="dark:text-polar-200 font-mono text-sm text-gray-700">
                {parameter.name}
              </span>
              <span className="dark:bg-polar-700 text-xxs rounded-md bg-gray-100 px-2 py-1 font-mono font-normal capitalize">
                {parameter.in} Parameter
              </span>
            </div>

            <span className="text-lg font-medium text-black dark:text-white">
              {parameter.schema &&
                'title' in parameter.schema &&
                parameter.schema?.title}
            </span>

            {parameter.description && (
              <p className="dark:text-polar-300 text-sm leading-normal text-gray-600">
                {parameter.description}
              </p>
            )}
          </ParameterItem>
        ))}
      </div>
    </div>
  )
}
