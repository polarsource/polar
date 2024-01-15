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
    if (!['IssueRead', 'PullRequestRead'].includes(key)) {
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

  // Hack! Downgrade schema to be compatible with the schema geneated by FastAPI v0.95.2 (pre Pydantic v2)
  walk(schema, (key, value) => {
    // Drop anyOf where one of the types if null. The schemas where this happens are already marked as non-required.
    //
    //
    // Input: (FastAPI v0.100 and later)
    //
    //    {
    //      "name": "payment_intent_id",
    //      "in": "query",±
    //      "required": false,
    //      "schema": {
    //          "anyOf": [
    //              {
    //                  "type": "string"
    //              },
    //              {
    //                  "type": "null"
    //              }
    //          ],
    //          "title": "Payment Intent Id"
    //      }
    //  },
    //
    //
    // Output
    //     {
    //       "name": "payment_intent_id",
    //       "in": "query",
    //       "required": false,
    //       "schema": {
    //           "title": "Payment Intent Id",
    //           "type": "string"
    //       }
    //   },

    if (value && typeof value === 'object' && 'anyOf' in value) {
      const anyOf = value['anyOf']

      if (anyOf.length === 2 && anyOf[1].type === 'null') {
        const res = {
          ...value,
          ...anyOf[0],
          anyOf: undefined,
        }
        return res
      }
    }

    return value
  })
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
