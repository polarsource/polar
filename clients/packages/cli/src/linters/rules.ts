export type LanguageId = 'typescript'

export type Severity = 'error' | 'warning'

/**
 * What a rule flags, written like the code it matches:
 *
 * - `Date.now(...)`  a call with any arguments
 * - `Date()`         a call with no arguments, with or without `new`
 * - `process.env`    a bare reference
 *
 * Matches are whole identifiers: `Date.now(...)` does not match `updateDate.now(...)`.
 */
export type Example = string

export interface Rule {
  readonly severity: Severity
  readonly message: string
  readonly code: Readonly<Partial<Record<LanguageId, ReadonlyArray<Example>>>>
}

export const RULES = {
  reads_clock: {
    severity: 'error',
    message: 'Reads the clock',
    code: {
      typescript: [
        'Date.now(...)',
        'Date()',
        'performance.now(...)',
        'process.hrtime',
        'Temporal.Now',
      ],
    },
  },
  reads_random: {
    severity: 'error',
    message: 'Uses a random value',
    code: {
      typescript: [
        'Math.random(...)',
        'randomUUID(...)',
        'randomBytes(...)',
        'getRandomValues(...)',
        'nanoid(...)',
        'uuid(...)',
      ],
    },
  },
  reads_network: {
    severity: 'error',
    message: 'Makes a network request',
    code: {
      typescript: [
        'fetch(...)',
        'XMLHttpRequest',
        'WebSocket',
        'Bun.connect(...)',
        'axios.',
        'got(...)',
        'ky(...)',
      ],
    },
  },
  reads_environment: {
    severity: 'warning',
    message: 'Reads an environment variable',
    code: {
      typescript: [
        'process.env',
        'process.argv',
        'Bun.env',
        'import.meta.env',
        'os.hostname(...)',
        'os.userInfo(...)',
        'Intl.DateTimeFormat(...)',
      ],
    },
  },
  reads_filesystem: {
    severity: 'warning',
    message: 'Reads a file',
    code: {
      typescript: [
        'readFile(...)',
        'readFileSync(...)',
        'readdir(...)',
        'readdirSync(...)',
        'existsSync(...)',
        'Bun.file(...)',
        'spawn(...)',
        'spawnSync(...)',
        'execSync(...)',
      ],
    },
  },
} as const satisfies Record<string, Rule>

export type RuleId = keyof typeof RULES
