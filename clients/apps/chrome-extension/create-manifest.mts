import { readFileSync } from 'fs'

let forProduction = false
let forDevelopment = false

for (const arg of process.argv) {
  if (arg === '--production') {
    forProduction = true
  }
  if (arg === '--dev') {
    forDevelopment = true
  }
}

if (forProduction && forDevelopment) {
  console.error('--production and --dev can not be set at the same time')
  process.exit(1)
}

if (!forProduction && !forDevelopment) {
  console.error('either --production or --dev needs to be set')
  process.exit(1)
}

// If development, keep keys starting with dev: but remove the prefix
// If production, keep keys starting with prod: but remove the prefix
const visit = (obj) => {
  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(visit)
  }

  const entries = Object.entries(obj)
    .map(([key, value]) => {
      if (key.startsWith('dev:')) {
        return forDevelopment ? [key.slice(4), visit(value)] : undefined
      }

      if (key.startsWith('prod:')) {
        return forProduction ? [key.slice(5), visit(value)] : undefined
      }

      return [key, visit(value)]
    })
    .filter((x) => x !== undefined)

  return Object.fromEntries(entries)
}

const manifest = JSON.parse(
  readFileSync('./src/manifest.template.json', 'utf-8'),
)

const output = visit(manifest)
console.log(JSON.stringify(output, null, 2))
