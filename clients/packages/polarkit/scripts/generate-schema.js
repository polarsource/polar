const axios = require('axios')
const fs = require('fs')

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
    }
  }
  console.log()

  // Hack! Replace the backends JSONAny with ts any
  // Only done for PullRequests and Issues
  console.log('🛠️  JSONAny -> Any')
  for (const [key, value] of Object.entries(schema.components.schemas)) {
    if (!['IssueRead', 'IssueDashboardRead', 'PullRequestRead'].includes(key)) {
      continue
    }

    for (const [property, propVal] of Object.entries(value.properties)) {
      if ('anyOf' in propVal) {
        console.log(`${key}.${property}: JSONAny -> Any`)
        propVal.type = 'any'
        delete propVal['anyOf']
      }
    }
  }
  console.log()
}

const getOpenAPISchema = async (schemaUrl) => {
  const schema = await axios.get(schemaUrl).then((response) => {
    return response.data
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
