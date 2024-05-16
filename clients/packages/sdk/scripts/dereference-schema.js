import refResolver from '@stoplight/json-ref-resolver'
import fs from 'fs'


const resolveRefs = async (schema) => {
    const resolver = new refResolver.Resolver()
    return await resolver.resolve(schema)
}

const getOpenAPISchema = async (schemaPath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(schemaPath, 'utf8', (err, data) => {
            if (err) {
                reject(err)
            }
            resolve(JSON.parse(data))
        })
    
    })
  }
  
  const save = (filename, schema) => {
    const asJson = JSON.stringify(schema, null, 4)
    const written = fs.writeFileSync(filename, asJson)
    return written
  }
  
  const main = async (schemaPath) => {
    let schema = await getOpenAPISchema(schemaPath)
    schema = (await resolveRefs(schema)).result
    save(schemaPath, schema)
  }
  
  const argv = process.argv.slice(2)
  if (argv.length !== 1) {
    throw new Error('Args: <schemaPath>')
  }
  main(argv[0])
  