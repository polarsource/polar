import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'
import AnchoredElement from './AnchoredElement'
import OptionalBadge from './OptionalBadge'
import { ParameterItem } from './ParameterItem'
import PropertyDefault from './PropertyDefault'
import PropertyType from './PropertyType'
import ProseWrapper from './ProseWrapper'
import RequiredBadge from './RequiredBadge'
import { isDereferenced } from './openapi'

export const Parameters = ({
  parameters,
}: {
  parameters: OpenAPIV3_1.ParameterObject[]
}) => {
  return (
    <div className="flex flex-col gap-y-6">
      <AnchoredElement id="parameters">
        <h3 className="group text-xl text-black dark:text-white">Parameters</h3>
      </AnchoredElement>

      <div className="flex flex-col gap-y-4">
        {parameters.map((parameter, index) => (
          <ParameterItem key={index}>
            <AnchoredElement id={['parameters', parameter.name]}>
              <div className="flex flex-row items-center gap-x-3">
                <span className="font-mono font-medium text-black dark:text-white">
                  {parameter.name}
                </span>
                <span className="text-xxs rounded-md bg-blue-50 px-2 py-1 font-mono font-normal capitalize text-blue-500 dark:bg-blue-950/50 dark:text-blue-300">
                  {parameter.in} Parameter
                </span>
                {parameter.schema &&
                  isDereferenced<OpenAPIV3_1.SchemaObject>(
                    parameter.schema,
                  ) && (
                    <>
                      <PropertyType property={parameter.schema} />
                      <PropertyDefault property={parameter.schema} />
                    </>
                  )}
                {parameter.required ? <RequiredBadge /> : <OptionalBadge />}
              </div>
            </AnchoredElement>

            {parameter.description && (
              <ProseWrapper className="text-sm">
                <Markdown>{parameter.description}</Markdown>
              </ProseWrapper>
            )}
          </ParameterItem>
        ))}
      </div>
    </div>
  )
}
