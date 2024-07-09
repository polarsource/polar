import { OpenAPIV3_1 } from 'openapi-types'
import AnchoredElement from './AnchoredElement'
import { Schema } from './Schema'
import { MediaType } from './openapi'

export const BodySchema = ({
  schema,
  mediaType,
}: {
  schema: OpenAPIV3_1.SchemaObject
  mediaType: MediaType
}) => {
  return (
    <div className="flex flex-col gap-y-6">
      <AnchoredElement id="body">
        <div className="flex flex-row items-center gap-2">
          <h3 className="group text-xl text-black dark:text-white">
            Request Body
          </h3>
          {mediaType !== MediaType.JSON && (
            <div className="text-xxs rounded-md bg-yellow-50 px-2 py-1 font-mono font-normal text-yellow-500 dark:bg-yellow-950/50">
              {mediaType}
            </div>
          )}
        </div>
      </AnchoredElement>

      <div className="flex flex-col gap-y-4">
        <Schema
          schema={schema}
          idPrefix={['body']}
          showRequired
          showDefault
          showWidgets
        />
      </div>
    </div>
  )
}
