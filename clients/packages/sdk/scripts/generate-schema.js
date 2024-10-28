import fs from 'fs'

const OVERRIDE_MAPPING = {}

let consumedOperationIds = {}

const ensureUnique = (operationId) => {
  /*
   * Let's avoid silently overwriting API methods due to name collisions.
   * Instead we ensure we throw an error here during generation.
   */
  if (operationId in consumedOperationIds) {
    throw new Error(`OperationId ${operationId} is not unique`)
  }
  return true
}

const createOperationId = (currentOperationId) => {
  // Hardcoded overrides, e.g FastAPI names from dependencies (FastAPI Users)
  if (currentOperationId in OVERRIDE_MAPPING) {
    return OVERRIDE_MAPPING[currentOperationId]
  }

  // FastAPI route names from our own code
  let parts = currentOperationId.split(':')
  return parts[parts.length - 1]
}

const GENERIC_TAGS = ['documented', 'featured', 'issue_funding']

// Remove generic tags and join them in a dotted string
// * ['users', 'documented', 'featured'] -> ['users']
// * ['users', 'benefits', 'documented', 'featured'] -> ['users.benefits']
const handleTags = (operation) => {
  const tags = operation.tags || []
  return [tags.filter((tag) => !GENERIC_TAGS.some((g) => g === tag)).join('.')]
}

const convert = (schema) => {
  console.log('🛠️  createOperationId')
  let newOperationId, currentOperationId
  for (const [key, value] of Object.entries(schema.paths)) {
    for (const [method, schema] of Object.entries(value)) {
      currentOperationId = schema.operationId
      newOperationId = createOperationId(currentOperationId)
      ensureUnique(newOperationId)
      console.log(
        `${key} -> ${currentOperationId} -> (${schema.tags[0]}.)${newOperationId}`,
      )
      schema.operationId = newOperationId
      schema.tags = handleTags(schema)
    }
  }

  // Hack! Pretend the schema is OpenAPI 3.0
  schema.openapi = '3.0.3'

  delete schema['webhooks']
}

const walk = (object, callback) => {
  for (const [key, val] of Object.entries(object)) {
    object[key] = callback(key, val)

    if (object[key] && typeof object[key] === 'object') {
      object[key] = walk(object[key], callback)
    }
  }

  return object
}

const getOpenAPISchema = async (schemaUrl) => {
  const schema = await fetch(schemaUrl).then((response) => {
    return response.json()
  })
  return schema
}

const save = (filename, schema) => {
  const asJson = JSON.stringify(schema, null, 4)
  const written = fs.writeFileSync(filename, asJson)
  return written
}

const main = async (schemaUrl, sourceFilename, generatedFilename) => {
  const schema = await getOpenAPISchema(schemaUrl)
  save(sourceFilename, schema)
  convert(schema)
  save(generatedFilename, schema)
}

const argv = process.argv.slice(2)
if (argv.length !== 3) {
  throw new Error('Args: <remoteSchemaUrl> <saveOriginalAs> <saveUpdatedAs>')
}
main(argv[0], argv[1], argv[2])
