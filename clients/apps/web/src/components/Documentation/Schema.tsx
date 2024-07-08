import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import AnchoredElement from './AnchoredElement'
import OptionalBadge from './OptionalBadge'
import { ParameterItem } from './ParameterItem'
import ParameterWidget from './ParameterWidget'
import PropertyDefault from './PropertyDefault'
import PropertyType from './PropertyType'
import ProseWrapper from './ProseWrapper'
import RequiredBadge from './RequiredBadge'
import {
  getUnionSchemas,
  isArraySchema,
  isDereferenced,
  isScalarArraySchema,
} from './openapi'

const UnionSchema = ({
  schemas: _schemas,
  idPrefix,
  parentsProperties,
  showRequired,
  showDefault,
  showWidgets,
}: {
  schemas: OpenAPIV3_1.SchemaObject[]
  idPrefix: string[]
  parentsProperties: string[]
  showRequired?: boolean
  showDefault?: boolean
  showWidgets?: boolean
}) => {
  const schemas = _schemas.filter(isDereferenced)
  const schemaValues = schemas.map((schema, index) =>
    [...idPrefix, schema.title || `schema_${index}`].join('_'),
  )
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
              <ProseWrapper className="text-sm">
                <Markdown>{schema.description}</Markdown>
              </ProseWrapper>
            )}
            <Schema
              schema={schema}
              idPrefix={[...idPrefix, schema.title || `schema_${index}`]}
              parentsProperties={parentsProperties}
              showRequired={showRequired}
              showDefault={showDefault}
              showWidgets={showWidgets}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

const SchemaProperty = ({
  name,
  property,
  required,
  idPrefix,
  parentsProperties,
  showRequired,
  showDefault,
  showWidgets,
}: {
  name: string
  property: OpenAPIV3_1.SchemaObject
  required: boolean
  idPrefix: string[]
  parentsProperties: string[]
  showRequired?: boolean
  showDefault?: boolean
  showWidgets?: boolean
}) => {
  return (
    <ParameterItem>
      <AnchoredElement id={[...idPrefix, name]}>
        <div className="flex flex-row items-center gap-x-3">
          <span className="font-mono font-medium text-black dark:text-white">
            {name}
          </span>
          <PropertyType property={property} />
          {showRequired && (
            <>{required ? <RequiredBadge /> : <OptionalBadge />}</>
          )}
          {showDefault && <PropertyDefault property={property} />}
        </div>
      </AnchoredElement>
      {property.description && (
        <ProseWrapper className="text-sm">
          <Markdown>{property.description}</Markdown>
        </ProseWrapper>
      )}
      {showWidgets &&
        property.type != 'object' &&
        (!isArraySchema(property) || isScalarArraySchema(property)) && (
          <ParameterWidget
            schema={property}
            parameterName={[...parentsProperties, name].join('.')}
            parameterIn="body"
          />
        )}
      {property.type == 'object' && (
        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
          <Schema
            schema={property}
            idPrefix={[...idPrefix, name]}
            parentsProperties={[...parentsProperties, name]}
            showRequired={showRequired}
            showDefault={showDefault}
            showWidgets={showWidgets}
          />
        </div>
      )}
      {isArraySchema(property) &&
        !isScalarArraySchema(property) &&
        isDereferenced(property.items) && (
          <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <Schema
              schema={property.items}
              idPrefix={[...idPrefix, name]}
              parentsProperties={[...parentsProperties, name]}
              showRequired={showRequired}
              showDefault={showDefault}
              showWidgets={showWidgets}
            />
          </div>
        )}
    </ParameterItem>
  )
}

const SchemaProperties = ({
  properties,
  required,
  idPrefix,
  parentsProperties,
  showRequired,
  showDefault,
  showWidgets,
}: {
  properties: {
    [name: string]: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject
  }
  required: string[]
  idPrefix: string[]
  parentsProperties: string[]
  showRequired?: boolean
  showDefault?: boolean
  showWidgets?: boolean
}) => {
  return (
    <div className="flex flex-col gap-y-4">
      {Object.entries(properties).map(
        ([key, property]: [
          key: string,
          property: OpenAPIV3_1.SchemaObject,
        ]) => (
          <SchemaProperty
            key={key}
            name={key}
            property={property}
            required={required.includes(key)}
            idPrefix={idPrefix}
            parentsProperties={parentsProperties}
            showRequired={showRequired}
            showDefault={showDefault}
            showWidgets={showWidgets}
          />
        ),
      )}
    </div>
  )
}

export const Schema = ({
  schema,
  idPrefix,
  showRequired,
  showDefault,
  showWidgets,
  parentsProperties,
}: {
  schema: OpenAPIV3_1.SchemaObject
  idPrefix: string[]
  showRequired?: boolean
  showDefault?: boolean
  showWidgets?: boolean
  parentsProperties?: string[]
}) => {
  const unionSchemas = getUnionSchemas(schema)
  if (unionSchemas) {
    return (
      <UnionSchema
        schemas={unionSchemas}
        idPrefix={idPrefix}
        showRequired={showRequired}
        showDefault={showDefault}
        showWidgets={showWidgets}
        parentsProperties={parentsProperties ?? []}
      />
    )
  }

  if (schema.properties) {
    return (
      <SchemaProperties
        properties={schema.properties ?? {}}
        required={schema.required || []}
        idPrefix={idPrefix}
        showRequired={showRequired}
        showDefault={showDefault}
        showWidgets={showWidgets}
        parentsProperties={parentsProperties ?? []}
      />
    )
  }
}
