/**
 * Professional CLI logger with colors and formatting
 */

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

const symbols = {
  check: '✓',
  cross: '✗',
  arrow: '→',
  bullet: '•',
  info: 'ℹ',
  warning: '⚠',
}

export function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`
}

export function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`
}

export function green(text: string): string {
  return `${colors.green}${text}${colors.reset}`
}

export function yellow(text: string): string {
  return `${colors.yellow}${text}${colors.reset}`
}

export function blue(text: string): string {
  return `${colors.blue}${text}${colors.reset}`
}

export function cyan(text: string): string {
  return `${colors.cyan}${text}${colors.reset}`
}

export function gray(text: string): string {
  return `${colors.gray}${text}${colors.reset}`
}

export function header(title: string): void {
  console.log()
  console.log(bold(blue(`  ${title}`)))
  console.log(gray('  ' + '─'.repeat(40)))
}

export function success(message: string): void {
  console.log(`  ${green(symbols.check)} ${message}`)
}

export function warning(message: string): void {
  console.log(`  ${yellow(symbols.warning)} ${message}`)
}

export function error(message: string): void {
  console.log(`  ${colors.bold}\x1b[31m${symbols.cross}${colors.reset} ${message}`)
}

export function info(message: string): void {
  console.log(`  ${cyan(symbols.info)} ${message}`)
}

export function item(message: string): void {
  console.log(`    ${gray(symbols.bullet)} ${message}`)
}

export function step(message: string): void {
  console.log(`  ${gray(symbols.arrow)} ${message}`)
}

export function blank(): void {
  console.log()
}

export function summary(stats: { translated: number; skipped: number; removed: number }): void {
  console.log()
  console.log(gray('  ' + '─'.repeat(50)))
  console.log(bold('  Summary'))
  console.log(`    Translated: ${green(stats.translated.toString())} keys`)
  console.log(`    Skipped:    ${gray(stats.skipped.toString())} keys ${dim('(unchanged)')}`)
  if (stats.removed > 0) {
    console.log(`    Removed:    ${yellow(stats.removed.toString())} keys ${dim('(orphaned)')}`)
  }
  console.log()
}

export function localeHeader(locale: string, localeName: string): void {
  console.log()
  console.log(`  ${bold(locale.toUpperCase())} ${dim(`(${localeName})`)}`)
}

export function done(message: string): void {
  console.log()
  console.log(`  ${green(symbols.check)} ${bold(message)}`)
  console.log()
}
