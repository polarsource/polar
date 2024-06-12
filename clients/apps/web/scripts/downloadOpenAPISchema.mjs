import { writeFileSync, existsSync } from 'node:fs'

const SCHEMA_URL = process.env.POLAR_OPENAPI_SCHEMA_URL || 'http://127.0.0.1:8000/openapi.json'
const SCHEMA_FILENAME = './src/openapi.json'

const downloadOpenAPISchema = async (schemaUrl, filename, force = false) => {
  if (!force && existsSync(filename)) {
    console.log('OpenAPI schema already exists')
    return
  }

  try {
    const response = await fetch(schemaUrl)
    const content = await response.text()
    writeFileSync(filename, content, { encoding: 'utf-8', flag: 'w+' })
    console.log('OpenAPI schema downloaded')
  } catch (err) {
    console.error(`Failed to download OpenAPI schema from ${schemaUrl}: ${err}`)
    console.error("Is the backend server running?")
    process.exit(1)
  }
}

const force = process.argv.includes('--force')
downloadOpenAPISchema(SCHEMA_URL, SCHEMA_FILENAME, force)
