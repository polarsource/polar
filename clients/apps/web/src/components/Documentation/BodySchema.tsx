import { OpenAPIV3_1 } from 'openapi-types'
import AnchoredElement from './AnchoredElement'
import { Schema } from './Schema'

export const BodySchema = ({
  schema,
}: {
  schema: OpenAPIV3_1.SchemaObject
}) => {
  return (
    <div className="flex flex-col gap-y-6">
      <AnchoredElement id="body">
        <h3 className="group text-xl text-black dark:text-white">
          Request Body
        </h3>
      </AnchoredElement>

      <div className="flex flex-col gap-y-4">
        <Schema schema={schema} idPrefix={['body']} showRequired showDefault />
      </div>
    </div>
  )
}
