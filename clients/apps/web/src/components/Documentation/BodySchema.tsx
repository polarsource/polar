import { OpenAPIV3_1 } from 'openapi-types'
import { Schema } from './Schema'

export const BodySchema = ({
  schema,
}: {
  schema: OpenAPIV3_1.SchemaObject
}) => {
  return (
    <div className="flex flex-col gap-y-6">
      <h3 className="text-xl text-black dark:text-white">Request Body</h3>

      <div className="flex flex-col gap-y-4">
        <Schema schema={schema} />
      </div>
    </div>
  )
}
