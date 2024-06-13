import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'
import AnchoredElement from './AnchoredElement'
import { MDXContentWrapper } from './MDXContentWrapper'
import OptionalBadge from './OptionalBadge'
import { ParameterItem } from './ParameterItem'
import PropertyType from './PropertyType'
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
                <span className="font-mono text-sm text-blue-500 dark:text-blue-400">
                  {parameter.name}
                </span>
                <span className="text-xxs rounded-md bg-blue-50 px-2 py-1 font-mono font-normal capitalize text-blue-500 dark:bg-blue-950/50 dark:text-blue-300">
                  {parameter.in} Parameter
                </span>
                {parameter.schema &&
                  isDereferenced<OpenAPIV3_1.SchemaObject>(
                    parameter.schema,
                  ) && <PropertyType property={parameter.schema} />}
                {parameter.required ? <RequiredBadge /> : <OptionalBadge />}
              </div>
            </AnchoredElement>

            <span className="text-lg font-medium text-black dark:text-white">
              {parameter.schema &&
                'title' in parameter.schema &&
                parameter.schema?.title}
            </span>

            {parameter.description && (
              <MDXContentWrapper className="text-sm">
                <Markdown>{parameter.description}</Markdown>
              </MDXContentWrapper>
            )}
          </ParameterItem>
        ))}
      </div>
    </div>
  )
}
