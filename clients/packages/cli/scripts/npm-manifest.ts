export const MAIN_PACKAGE = '@polar-sh/cli'
export const PLATFORM_PACKAGE_PREFIX = `${MAIN_PACKAGE}-`
export const COMMAND = 'polar'

const repository = {
  type: 'git',
  url: 'git+https://github.com/polarsource/polar.git',
  directory: 'clients/packages/cli',
}

export interface Target {
  readonly bun: string
  readonly os: 'darwin' | 'linux' | 'win32'
  readonly arch: 'arm64' | 'x64'
}

export const targets: ReadonlyArray<Target> = [
  { bun: 'bun-darwin-arm64', os: 'darwin', arch: 'arm64' },
  { bun: 'bun-darwin-x64', os: 'darwin', arch: 'x64' },
  { bun: 'bun-linux-arm64', os: 'linux', arch: 'arm64' },
  { bun: 'bun-linux-x64', os: 'linux', arch: 'x64' },
  { bun: 'bun-windows-x64', os: 'win32', arch: 'x64' },
]

export const findTarget = (bunTarget: string | undefined): Target => {
  const target = targets.find((item) => item.bun === bunTarget)
  if (!target) {
    throw new Error(
      `Unknown target ${bunTarget ?? '(none)'}; expected one of ${targets.map((item) => item.bun).join(', ')}`,
    )
  }
  return target
}

export const platformName = (target: Target) =>
  `${target.os === 'win32' ? 'windows' : target.os}-${target.arch}`

export const platformPackageName = (target: Target) =>
  `${PLATFORM_PACKAGE_PREFIX}${platformName(target)}`

export const platformDirectory = (target: Target) =>
  `cli-${platformName(target)}`

export const binaryName = (os: Target['os']) =>
  os === 'win32' ? `${COMMAND}.exe` : COMMAND

export const platformManifest = (target: Target, version: string) => ({
  name: platformPackageName(target),
  version,
  description: `Polar CLI binary for ${platformName(target)}`,
  license: 'Apache-2.0',
  repository,
  os: [target.os],
  cpu: [target.arch],
})

export const mainManifest = (
  version: string,
  binaries: Readonly<Record<string, string>>,
) => {
  const names = Object.keys(binaries)
  if (names.length === 0) throw new Error('No platform packages to publish')
  for (const name of names) {
    if (!name.startsWith(PLATFORM_PACKAGE_PREFIX)) {
      throw new Error(`${name} is not a ${MAIN_PACKAGE} platform package`)
    }
    if (binaries[name] !== version) {
      throw new Error(
        `${name}@${binaries[name]} does not match ${MAIN_PACKAGE}@${version}`,
      )
    }
  }
  return {
    name: MAIN_PACKAGE,
    version,
    description:
      'Polar CLI: tunnel webhooks locally and manage your Polar organization from the terminal',
    license: 'Apache-2.0',
    repository,
    homepage: 'https://polar.sh',
    bin: { [COMMAND]: `bin/${COMMAND}.exe` },
    scripts: { postinstall: 'node ./postinstall.mjs' },
    os: ['darwin', 'linux', 'win32'],
    cpu: ['arm64', 'x64'],
    optionalDependencies: Object.fromEntries(
      names.sort().map((name) => [name, binaries[name]]),
    ),
  }
}

export const placeholderBinary = () =>
  [
    `echo "Error: ${MAIN_PACKAGE}'s postinstall script was not run." >&2`,
    'echo "" >&2',
    'echo "This occurs when installation scripts are disabled." >&2',
    `echo "Run the package postinstall script or reinstall with scripts enabled, or install with: curl -fsSL https://polar.sh/install.sh | bash" >&2`,
    'exit 1',
    '',
  ].join('\n')

export const readme = (version: string) =>
  `# Polar CLI

Tunnel webhooks to your local environment and manage your Polar organization from the terminal.

\`\`\`bash
npm install -g ${MAIN_PACKAGE}
polar login
polar listen http://localhost:3000/
\`\`\`

This package installs the prebuilt \`polar\` binary for your platform from one of the
\`${PLATFORM_PACKAGE_PREFIX}*\` packages in a postinstall step. pnpm and bun block
install scripts by default, so allow this one:

\`\`\`bash
pnpm add -g --allow-build=${MAIN_PACKAGE} ${MAIN_PACKAGE}
bun install -g --trust ${MAIN_PACKAGE}
\`\`\`

If installation scripts stay disabled, the \`polar\` command prints an error instead of
running. Install with \`curl -fsSL https://polar.sh/install.sh | bash\` in that case.

Version ${version}. Source and documentation: https://github.com/polarsource/polar/tree/main/clients/packages/cli
`
