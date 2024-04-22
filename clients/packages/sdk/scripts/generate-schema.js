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

  // Hack! Pretend the schema is OpenAPI 3.0
  schema.openapi = '3.0.3'

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
    // Remove consts
    //
    // Input: (FastAPI v0.100 and later)
    //
    //    "setup_future_usage": {
    //      "title": "Setup Future Usage",
    //      "description": "If the payment method should be saved for future usage.",
    //      "const": "on_session"
    //  },
    //
    //
    // Output
    // "setup_future_usage": {
    //   "description": "If the payment method should be saved for future usage.",
    //   "enum": ["on_session"],
    //   "title": "Setup Future Usage",
    //   "type": "string"
    // }

    if (value && typeof value === 'object' && 'const' in value) {
      return {
        ...value,
        enum: [value['const']],
        const: undefined,
      }
    }

    return value
  })

  delete schema['webhooks']

  // Hack! Rewrite "-Input" and "-Output" names
  let inputOutputs = []
  walk(schema, (key, value) => {
    if (key.endsWith('-Input') || key.endsWith('-Output')) {
      inputOutputs.push(key)
    }
    return value
  })

  console.log({ inputOutputs })

  // Hack! To keep the schema consistent to what FastAPI generated _before_ introducing webhooks to the schema.
  // For some reason existing models where given "-Input" and "-Output" suffixes, breaking the generated code.
  walk(schema, (key, value) => {
    if (value && typeof value === 'string') {
      if (
        value.startsWith('#/components/schemas/') &&
        (value.endsWith('-Input') || value.endsWith('-Output'))
      ) {
        const preValue = value
        value = value.replace('-Input', '').replace('-Output', '')
        console.log(`S: Rewrote ${preValue} as ${value}`)
      }
      return value
    }

    if (value && typeof value === 'object') {
      let modValue = value

      for (const name of inputOutputs) {
        const newName = name.replace('-Input', '').replace('-Output', '')

        if (name in value) {
          console.log(`O: Rewrote ${name} as ${newName}`)
          let newValue = { ...modValue }
          newValue[newName] = modValue[name]
          newValue[name] = undefined
          modValue = newValue
        }
      }

      return modValue
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
