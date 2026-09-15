#!/usr/bin/env node
import 'tsx'

const { run } = await import('../src/cli/index.ts')
const load = (url) => import(url)

run(process.argv.slice(2), load).then(
  () => process.exit(0),
  () => process.exit(1),
)
