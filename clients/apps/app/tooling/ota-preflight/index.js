#!/usr/bin/env node
'use strict'

/**
 * OTA preflight guard.
 *
 * We run EAS Update with the `appVersion` runtime, meaning there is a possibility
 * to ship native changes as an OTA.
 *
 * This script checks if the current working tree is compatible with the latest
 * finished build on the target channel.
 *
 * Usage:
 *   pnpm ota --channel production --message "Fix X"   # check, then publish
 *   pnpm ota --channel production --check-only        # check only, don't publish
 */

const { execFileSync, spawnSync } = require('node:child_process')
const path = require('node:path')

const { diffFingerprints, stripPnpmPeerHashes } = require('./fingerprint-diff')

const APP_DIR = path.resolve(__dirname, '../..')
const PLATFORMS = ['ios', 'android']
const OWN_FLAGS = new Set(['--check-only'])
const OTA_BRANCH = 'main'

const REASON_LABELS = {
  expoAutolinkingIos: 'native module (iOS autolinking)',
  expoAutolinkingAndroid: 'native module (Android autolinking)',
  rncoreAutolinkingIos: 'native module (iOS RN-core autolinking)',
  rncoreAutolinkingAndroid: 'native module (Android RN-core autolinking)',
  expoConfigPlugins: 'config plugin',
  expoConfig: 'app config (native-affecting fields)',
  expoConfigExternalFile: 'native asset baked into the binary',
  'package:react-native': 'react-native version',
  'packageJson:scripts': 'package.json scripts',
  easBuild: 'eas.json build config',
  bareGitIgnore: '.gitignore',
}

const CHANGE_VERBS = {
  added: 'added (only in working tree)',
  removed: 'removed (gone from working tree)',
  modified: 'modified',
}

function parseArgs(argv) {
  return {
    channel: readOption(argv, '--channel'),
    checkOnly: argv.includes('--check-only'),
    forwarded: argv.filter((arg) => !OWN_FLAGS.has(arg)),
  }
}

function readOption(argv, name) {
  const flagIndex = argv.indexOf(name)
  if (flagIndex !== -1) {
    const value = argv[flagIndex + 1]
    return value && !value.startsWith('--') ? value : undefined
  }
  const inline = argv.find((arg) => arg.startsWith(`${name}=`))
  return inline ? inline.slice(name.length + 1) : undefined
}

function git(args) {
  return execFileSync('git', args, {
    cwd: APP_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function checkGitState() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch !== OTA_BRANCH) {
    return (
      `On branch "${branch}", but OTAs must ship from "${OTA_BRANCH}". ` +
      `Switch branches before publishing.`
    )
  }

  const dirty = git(['status', '--porcelain'])
  if (dirty) {
    const files = dirty
      .split('\n')
      .map((line) => `      ${line}`)
      .join('\n')
    return (
      'Working tree has uncommitted changes — the OTA bundle is built from the ' +
      'working tree, so commit or stash them to avoid shipping unintended code:\n' +
      files
    )
  }

  return undefined
}

function resolveRuntimeVersion() {
  const { expo } = require(path.join(APP_DIR, 'app.config.js'))
  const policy = expo.runtimeVersion
  if (typeof policy === 'string') return policy
  if (policy?.policy === 'appVersion' || policy?.policy === 'nativeVersion') {
    return expo.version
  }
  return undefined
}

function resolveEasCommand() {
  try {
    execFileSync('eas', ['--version'], { stdio: 'ignore' })
    return ['eas']
  } catch {
    return ['npx', '--yes', 'eas-cli']
  }
}

function createEasClient() {
  const [cmd, ...prefix] = resolveEasCommand()

  const runJson = (args) => {
    const stdout = execFileSync(cmd, [...prefix, ...args], {
      cwd: APP_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    return JSON.parse(stdout)
  }

  return {
    listFinishedBuilds(platform, channel) {
      const builds = runJson([
        'build:list',
        '--platform',
        platform,
        '--status',
        'finished',
        '--channel',
        channel,
        '--limit',
        '20',
        '--json',
        '--non-interactive',
      ])
      return Array.isArray(builds) ? builds : []
    },

    compareToBuild(buildId) {
      return runJson([
        'fingerprint:compare',
        '--build-id',
        buildId,
        '--json',
        '--non-interactive',
      ])
    },

    publish(args) {
      const { status } = spawnSync(cmd, [...prefix, 'update', ...args], {
        cwd: APP_DIR,
        stdio: 'inherit',
      })
      return status ?? 0
    },
  }
}

const buildRuntime = (build) =>
  String(build.runtimeVersion ?? build.runtime?.version ?? '')

function checkPlatform(eas, platform, { channel, runtime }) {
  const builds = eas.listFinishedBuilds(platform, channel)
  if (builds.length === 0) {
    return { platform, status: 'skipped' }
  }

  const build = runtime
    ? builds.find((candidate) => buildRuntime(candidate) === runtime)
    : builds[0]
  if (!build) {
    return { platform, status: 'missing-build' }
  }

  const { fingerprint1, fingerprint2 } = eas.compareToBuild(build.id)
  const changes = diffFingerprints(fingerprint1, fingerprint2)
  return changes.length === 0
    ? { platform, status: 'ok', build }
    : { platform, status: 'native-drift', build, changes }
}

const isBlocking = (result) =>
  result.status === 'missing-build' || result.status === 'native-drift'

function blockerMessage(result, runtime) {
  if (result.status === 'missing-build') {
    return (
      `No finished ${result.platform} build on this channel has runtime "${runtime}". ` +
      `An OTA for this runtime would reach 0 devices, so bump the build and submit it first.`
    )
  }
  return (
    `${result.platform}: native layer differs from the installed build. OTA-delivered JS may crash. ` +
    'Bump `version` in app.config.js and cut a new store build.'
  )
}

function describeSourceChange({ kind, source }) {
  const locator =
    source.filePath != null ? stripPnpmPeerHashes(source.filePath) : source.id
  const marker = 'node_modules/'
  const cut = locator.lastIndexOf(marker)
  const name = cut === -1 ? locator : locator.slice(cut + marker.length)
  const reasons = (source.reasons ?? []).map((r) => REASON_LABELS[r] ?? r)
  const suffix = reasons.length ? `  [${reasons.join(', ')}]` : ''
  return `      • ${CHANGE_VERBS[kind]}: ${name}${suffix}`
}

function reportResult(result) {
  const label = result.platform.padEnd(8)
  const where = result.build
    ? `build ${String(result.build.id).slice(0, 8)} (v${buildRuntime(result.build)})`
    : ''

  switch (result.status) {
    case 'skipped':
      console.log(`   ${label} no finished builds on this channel — skipped`)
      return
    case 'missing-build':
      console.log(`   ${label} no matching build for this runtime`)
      return
    case 'ok':
      console.log(`   ${label} native layer matches ${where}`)
      return
    case 'native-drift':
      console.log(`   ${label} native changes vs ${where}:`)
      result.changes.forEach((change) =>
        console.log(describeSourceChange(change)),
      )
      return
  }
}

function reportBlockers(blockers) {
  console.error('\n──────────────────────────────────────────────')
  console.error('OTA preflight found native incompatibilities:\n')
  blockers.forEach((reason) => console.error(`  • ${reason}`))
  console.error(
    '\nThese changes cannot be delivered as an OTA. Build & submit a new binary, then OTA JS-only fixes on top of it.',
  )
}

function main(argv) {
  const { channel, checkOnly, forwarded } = parseArgs(argv)
  if (!channel) {
    console.error(
      '\n❌ Missing --channel. Usage: pnpm ota --channel production --message "…"\n',
    )
    return 2
  }

  const runtime = resolveRuntimeVersion()
  console.log(
    `\n🔎 OTA preflight — channel "${channel}"` +
      (runtime ? `, runtime "${runtime}" (appVersion policy)` : '') +
      '\n',
  )

  if (!checkOnly) {
    const gitIssue = checkGitState()
    if (gitIssue) {
      console.error('──────────────────────────────────────────────')
      console.error('OTA preflight blocked by git state:\n')
      console.error(`  • ${gitIssue}\n`)
      return 1
    }
    console.log(`   ${'git'.padEnd(8)} on ${OTA_BRANCH}, working tree clean`)
  }

  const eas = createEasClient()
  const results = PLATFORMS.map((platform) =>
    checkPlatform(eas, platform, { channel, runtime }),
  )
  results.forEach(reportResult)

  const blockers = results
    .filter(isBlocking)
    .map((result) => blockerMessage(result, runtime))

  if (blockers.length > 0) {
    reportBlockers(blockers)
    return 1
  }
  console.log('\n✅ Preflight passed, safe to ship!\n')

  if (checkOnly) return 0

  const updateArgs = forwarded[0] === 'update' ? forwarded.slice(1) : forwarded
  console.log(`eas update ${updateArgs.join(' ')}\n`)
  return eas.publish(updateArgs)
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (error) {
    console.error(`\n❌ ${error.message || error}\n`)
    process.exit(1)
  }
}

module.exports = { main, checkPlatform }
