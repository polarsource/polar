import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import AnchoredElement from './AnchoredElement'
import { MDXContentWrapper } from './MDXContentWrapper'
import OptionalBadge from './OptionalBadge'
import { ParameterItem } from './ParameterItem'
import PropertyType from './PropertyType'
import RequiredBadge from './RequiredBadge'
import { getUnionSchemas, isSchemaObject } from './openapi'

const UnionSchema = ({
  schemas: _schemas,
  idPrefix,
}: {
  schemas: OpenAPIV3_1.SchemaObject[]
  idPrefix: string[]
}) => {
  const schemas = _schemas.filter(isSchemaObject)
  const schemaValues = schemas.map((_, index) => `schema_${index}`)
  return (
    <Tabs>
      <div className="overflow-x-auto">
        <TabsList defaultValue="schema_0">
          {schemas.map((schema, index) => (
            <TabsTrigger key={index} value={schemaValues[index]}>
              {schema.title || `Schema ${index + 1}`}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {schemas.map((schema, index) => (
        <TabsContent key={index} value={schemaValues[index]}>
          <div className="flex flex-col gap-y-4">
            {schema.description && (
              <MDXContentWrapper className="text-sm">
                <Markdown>{schema.description}</Markdown>
              </MDXContentWrapper>
            )}
            <Schema
              schema={schema}
              idPrefix={[...idPrefix, schema.title || `schema_${index}`]}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

const SchemaProperties = ({
  properties,
  required,
  idPrefix,
}: {
  properties: {
    [name: string]: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject
  }
  required: string[]
  idPrefix: string[]
}) => {
  return (
    <div className="flex flex-col gap-y-4">
      {Object.entries(properties).map(
        ([key, property]: [
          key: string,
          property: OpenAPIV3_1.SchemaObject,
        ]) => (
          <ParameterItem key={key}>
            <AnchoredElement id={[...idPrefix, key]}>
              <div className="flex flex-row items-center gap-x-3">
                <span className="font-mono text-sm text-blue-500 dark:text-blue-400">
                  {key}
                </span>
                <PropertyType property={property} />
                {required.includes(key) ? <RequiredBadge /> : <OptionalBadge />}
              </div>
            </AnchoredElement>
            <span className="text-lg font-medium text-black dark:text-white">
              {property.title}
            </span>
            {property.description && (
              <MDXContentWrapper className="text-sm">
                <Markdown>{property.description}</Markdown>
              </MDXContentWrapper>
            )}
            {property.type == 'object' && (
              <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
                <Schema schema={property} idPrefix={[...idPrefix, key]} />
              </div>
            )}
            {property.type == 'array' && (
              <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
                <Schema schema={property.items} idPrefix={[...idPrefix, key]} />
              </div>
            )}
          </ParameterItem>
        ),
      )}
    </div>
  )
}

export const Schema = ({
  schema,
  idPrefix,
}: {
  schema: OpenAPIV3_1.SchemaObject
  idPrefix: string[]
}) => {
  const unionSchemas = getUnionSchemas(schema)
  if (unionSchemas) {
    return <UnionSchema schemas={unionSchemas} idPrefix={idPrefix} />
  }

  if (schema.properties) {
    return (
      <SchemaProperties
        properties={schema.properties ?? {}}
        required={schema.required || []}
        idPrefix={idPrefix}
      />
    )
  }
}
