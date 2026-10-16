export const MAIN_PACKAGE = '@polar-sh/cli'
export const PLATFORM_PACKAGE_PREFIX = `${MAIN_PACKAGE}-`
export const COMMAND = 'polar'

const repository = {
  type: 'git',
  url: 'git+https://github.com/polarsource/polar.git',
  directory: 'clients/packages/cli',
}

interface Target {
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

const platformName = (target: Target) =>
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

[![npm](https://img.shields.io/npm/v/${MAIN_PACKAGE}?label=npm)](https://www.npmjs.com/package/${MAIN_PACKAGE})
[![Release CLI](https://github.com/polarsource/polar/actions/workflows/release_cli.yml/badge.svg)](https://github.com/polarsource/polar/actions/workflows/release_cli.yml)

The Polar CLI helps you build, test and manage your Polar integration from the terminal. It is built for people and for AI agents alike.

**With the CLI, you can:**

- Receive webhooks on your local machine, signed exactly like production
- Trigger sample events to exercise your webhook handler
- List, create, update and delete products, customers, orders and other API objects
- Create access tokens for CI and local development
- Hand it to an AI agent: everything speaks JSON and runs without prompts

\`\`\`bash
npm install -g ${MAIN_PACKAGE}
polar auth login
polar webhook listen 3000
\`\`\`

## Installation

The CLI is a single binary for macOS (Apple Silicon and Intel), Linux (x64 and ARM64) and Windows (x64).

### npm, pnpm, bun

\`\`\`bash
npm install -g ${MAIN_PACKAGE}
\`\`\`

pnpm and bun block install scripts by default. This package unpacks the binary for your platform from one of the \`${PLATFORM_PACKAGE_PREFIX}*\` packages in a postinstall step, so allow it:

\`\`\`bash
pnpm add -g --allow-build=${MAIN_PACKAGE} ${MAIN_PACKAGE}
bun install -g --trust ${MAIN_PACKAGE}
\`\`\`


### macOS and Linux

\`\`\`bash
curl -fsSL https://polar.sh/install.sh | bash
\`\`\`

### Windows

\`\`\`powershell
irm https://polar.sh/install.ps1 | iex
\`\`\`

### Without package managers

Download the binary for your platform from the [latest release](https://github.com/polarsource/polar/releases/tag/${MAIN_PACKAGE}@${version}) and put it on your \`PATH\`.

Check that it works with \`polar --version\`.

## Built for agents

Point Claude Code, Cursor, Codex or any other agent at \`polar\` and it can run your whole Polar setup from the terminal:

- API commands print JSON, and \`--json\` turns every other command's output and every error into JSON too. Errors carry a \`hint\` with the fix.
- \`--fields\` keeps only the fields the agent needs, so responses stay small.
- No hidden prompts: \`--sandbox\`/\`--production\` pick the environment, \`--confirm\` approves destructive commands, and \`--help\` describes every command with examples.
- \`POLAR_ACCESS_TOKEN\` authenticates without a browser, in CI or a sandboxed agent.

\`\`\`bash
polar products list --fields id,name,prices.price_amount
polar customers delete <id> --confirm
\`\`\`

Prefer tools over a shell? The same capabilities are available through the [Polar MCP server](https://polar.sh/docs/integrate/mcp).

## Usage

Sign in once, in sandbox or production, and pick the organization to work on:

\`\`\`bash
polar auth login --sandbox
polar auth org
\`\`\`

**Webhooks.** \`listen\` creates a webhook endpoint for you and forwards every delivery to your local server. \`trigger\` sends a sample event through it.

\`\`\`bash
polar webhook listen 3000
polar webhook trigger order.paid
polar webhook listen --print-secret   # the signing secret for your .env
\`\`\`

**API objects.** API commands print the response as JSON; \`--fields\` keeps only the fields you name. Commands that delete or revoke ask before they act; pass \`--confirm\` to run them unattended.

\`\`\`bash
polar products list
polar customers get <id>
polar orders list --fields id,total_amount,customer.email
polar subscriptions revoke <id>
\`\`\`

**Tokens.** Create an organization access token for your app or CI. When \`POLAR_ACCESS_TOKEN\` is set, the CLI uses it instead of your login.

\`\`\`bash
echo "POLAR_ACCESS_TOKEN=$(polar auth token)" >> .env.local
polar auth token --scope products:read | gh secret set POLAR_ACCESS_TOKEN
\`\`\`

Every command, argument and flag is in the [command reference](https://polar.sh/docs/integrate/cli/reference).

## Upgrading

\`\`\`bash
polar update
\`\`\`

\`update\` detects how the CLI was installed and upgrades through the same channel. With npm, \`npm install -g ${MAIN_PACKAGE}\` does the same.

## Uninstalling

Sign out first so no sessions are left in your OS keychain, then remove the binary the way you installed it:

\`\`\`bash
polar auth logout --all
npm uninstall -g ${MAIN_PACKAGE}          # npm
rm /usr/local/bin/polar                   # install.sh
\`\`\`

On Windows, delete \`%USERPROFILE%\\.polar\\bin\` and remove it from your user \`PATH\`.

## Documentation

- [Introduction](https://polar.sh/docs/integrate/cli/introduction)
- [Authentication](https://polar.sh/docs/integrate/cli/authentication)
- [Webhooks](https://polar.sh/docs/integrate/cli/webhooks)
- [Command reference](https://polar.sh/docs/integrate/cli/reference)
- [Source code](https://github.com/polarsource/polar/tree/main/clients/packages/cli)

Version ${version}.
`
