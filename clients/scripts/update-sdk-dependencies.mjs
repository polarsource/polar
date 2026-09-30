import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const [version] = process.argv.slice(2)
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Usage: node scripts/update-sdk-dependencies.mjs <X.Y.Z>')
}

const packages = []
let updated = false
const directories = await readdir('adapters', { withFileTypes: true })
const packagePaths = directories
  .filter((directory) => directory.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((directory) => join('adapters', directory.name, 'package.json'))
packagePaths.push(join('packages', 'cli', 'package.json'))

for (const packagePath of packagePaths) {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  if (packageJson.private && packageJson.name !== 'polar-cli') continue

  let packageUpdated = false
  for (const section of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const sdkVersion = packageJson[section]?.['@polar-sh/sdk']
    if (!sdkVersion) continue

    const prefix = sdkVersion.match(/^[~^]/)?.[0] ?? ''
    const nextVersion = `${prefix}${version}`
    if (sdkVersion === nextVersion) continue

    packageJson[section]['@polar-sh/sdk'] = nextVersion
    packageUpdated = true
  }

  if (packageUpdated) {
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
    packages.push(packageJson.name)
    updated = true
  }
}

if (updated) {
  const releases = packages.map((name) => `"${name}": patch`).join('\n')
  await writeFile(
    join('.changeset', `sdk-${version}.md`),
    `---\n${releases}\n---\n\nUpdate \`@polar-sh/sdk\` to version ${version}.\n`,
  )
}
