'use strict'
const PNPM_VIRTUAL_STORE = /\.pnpm\/([^/]+)\/node_modules\//g

function stripPnpmPeerHashes(value) {
  return String(value).replace(
    PNPM_VIRTUAL_STORE,
    (_match, segment) => `.pnpm/${segment.split('_')[0]}/node_modules/`,
  )
}

function sourceIdentity(source) {
  const locator =
    source.filePath != null ? stripPnpmPeerHashes(source.filePath) : source.id
  return JSON.stringify([source.type, locator, source.reasons ?? []])
}

function sourceDigest(source) {
  switch (source.type) {
    case 'contents':
      return stripPnpmPeerHashes(source.contents ?? '')
    case 'dir':
      return ''
    default:
      return source.hash ?? ''
  }
}

function indexByIdentity(fingerprint) {
  return new Map(
    fingerprint.sources.map((source) => [
      sourceIdentity(source),
      { digest: sourceDigest(source), source },
    ]),
  )
}

function diffFingerprints(baseline, candidate) {
  const before = indexByIdentity(baseline)
  const after = indexByIdentity(candidate)
  const changes = []

  for (const [identity, entry] of after) {
    const prior = before.get(identity)
    if (!prior) {
      changes.push({ kind: 'added', source: entry.source })
    } else if (prior.digest !== entry.digest) {
      changes.push({ kind: 'modified', source: entry.source })
    }
  }

  for (const [identity, entry] of before) {
    if (!after.has(identity)) {
      changes.push({ kind: 'removed', source: entry.source })
    }
  }

  return changes
}

module.exports = {
  stripPnpmPeerHashes,
  sourceIdentity,
  sourceDigest,
  diffFingerprints,
}
