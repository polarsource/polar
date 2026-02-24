import { Command, Options } from '@effect/cli'
import { Effect } from 'effect'
import { NodeFileSystem } from '@effect/platform-node'
import { FileSystem } from '@effect/platform'
import fg from 'fast-glob'
import { join, resolve } from 'node:path'
import { parseYamlFile } from '../parse/yaml.js'
import { validateTokenNames } from '../parse/token-names.js'
import { resolveAliases } from '../resolve/aliases.js'
import { defaultRegistry } from '../transform/built-in.js'
import { formatCss } from '../format/css.js'
import { formatJson } from '../format/json.js'
import { formatTypescript } from '../format/typescript.js'
import { formatTypescriptVars } from '../format/typescript-vars.js'
import type { BreakpointConfig, FlatTokenMap, ThemeConfig, TokenGroup } from '../types.js'

const inputOption = Options.text('input').pipe(
  Options.withAlias('i'),
  Options.withDescription('Glob pattern for YAML token files'),
  Options.withDefault('tokens/**/*.yaml'),
)

const outputOption = Options.text('output').pipe(
  Options.withAlias('o'),
  Options.withDescription('Output directory'),
  Options.withDefault('./dist'),
)

const formatOption = Options.text('format').pipe(
  Options.withAlias('f'),
  Options.withDescription('Comma-separated list of output formats: css, json, ts'),
  Options.withDefault('css,json,ts'),
)

const watchOption = Options.boolean('watch').pipe(
  Options.withAlias('w'),
  Options.withDescription('Watch mode'),
  Options.withDefault(false),
)

/** JSON string mapping theme names to CSS selectors. */
const themesOption = Options.text('themes').pipe(
  Options.withDescription(
    'JSON map of theme name → CSS selector for multi-theme output. ' +
      'e.g. \'{"dark":":root .dark"}\'',
  ),
  Options.optional,
)

/** JSON string mapping breakpoint names to CSS media query conditions. */
const breakpointsOption = Options.text('breakpoints').pipe(
  Options.withDescription(
    'JSON map of breakpoint name → CSS media query condition for responsive output. ' +
      'e.g. \'{"sm":"(min-width: 640px)","md":"(min-width: 768px)"}\'',
  ),
  Options.optional,
)

const transformOption = Options.text('transform').pipe(
  Options.withDescription(
    'Named transform pipeline to apply to token values. ' +
      `Built-in pipelines: ${defaultRegistry.pipelines().join(', ')}.`,
  ),
  Options.withDefault('default'),
)

const runBuild = (opts: {
  input: string
  output: string
  format: string
  watch: boolean
  themes: string | undefined
  breakpoints: string | undefined
  transform: string
}) =>
  Effect.gen(function* () {
    const { input, output, format: formatStr, themes: themesJson, breakpoints: breakpointsJson, transform } = opts
    const formats = formatStr.split(',').map((f) => f.trim())
    const outputDir = resolve(output)

    // Parse theme config from JSON option
    let themeConfig: ThemeConfig | undefined
    if (themesJson) {
      themeConfig = yield* Effect.try({
        try: () => JSON.parse(themesJson) as ThemeConfig,
        catch: () =>
          new Error(`--themes must be a valid JSON object, e.g. '{"dark":":root .dark"}'`),
      })
    }

    // Parse breakpoint config from JSON option
    let breakpointConfig: BreakpointConfig | undefined
    if (breakpointsJson) {
      breakpointConfig = yield* Effect.try({
        try: () => JSON.parse(breakpointsJson) as BreakpointConfig,
        catch: () =>
          new Error(`--breakpoints must be a valid JSON object, e.g. '{"sm":"(min-width: 640px)"}'`),
      })
    }

    // Find all matching YAML files
    const files = yield* Effect.tryPromise({
      try: () => fg(input, { dot: false }),
      catch: (e) => new Error(`Failed to expand glob "${input}": ${String(e)}`),
    })

    if (files.length === 0) {
      yield* Effect.log(`No files matched pattern: ${input}`)
      return
    }

    yield* Effect.log(`Processing ${files.length} file(s)...`)

    // Parse all files and merge into one token group
    const groups: TokenGroup[] = yield* Effect.all(
      files.map((file) => parseYamlFile(file)),
    )

    const merged: TokenGroup = Object.assign({}, ...groups)
    yield* validateTokenNames(merged)

    // Pipeline: resolve aliases → apply named transform pipeline → format
    const flatMap = yield* resolveAliases(merged)
    const finalMap: FlatTokenMap = yield* defaultRegistry.apply(transform, flatMap)

    // Ensure output directory exists
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(outputDir, { recursive: true })

    // Format and write outputs
    if (formats.includes('css')) {
      const css = yield* formatCss(finalMap, themeConfig, breakpointConfig)
      yield* fs.writeFileString(join(outputDir, 'tokens.css'), css)
      yield* Effect.log(`Wrote tokens.css`)
    }

    if (formats.includes('json')) {
      const json = yield* formatJson(finalMap, themeConfig, breakpointConfig)
      yield* fs.writeFileString(join(outputDir, 'tokens.json'), json)
      yield* Effect.log(`Wrote tokens.json`)
    }

    if (formats.includes('ts') || formats.includes('typescript')) {
      const ts = yield* formatTypescript(finalMap, themeConfig, breakpointConfig)
      yield* fs.writeFileString(join(outputDir, 'tokens.ts'), ts)
      yield* Effect.log(`Wrote tokens.ts`)
    }

    if (formats.includes('ts-vars')) {
      const tsVars = yield* formatTypescriptVars(finalMap)
      yield* fs.writeFileString(join(outputDir, 'vars.ts'), tsVars)
      yield* Effect.log(`Wrote vars.ts`)
    }

    yield* Effect.log(`Done.`)
  }).pipe(Effect.provide(NodeFileSystem.layer))

export const buildCommand = Command.make(
  'build',
  {
    input: inputOption,
    output: outputOption,
    format: formatOption,
    watch: watchOption,
    themes: themesOption,
    breakpoints: breakpointsOption,
    transform: transformOption,
  },
  ({ input, output, format, watch, themes, breakpoints, transform }) =>
    runBuild({
      input,
      output,
      format,
      watch,
      themes: themes._tag === 'Some' ? themes.value : undefined,
      breakpoints: breakpoints._tag === 'Some' ? breakpoints.value : undefined,
      transform,
    }),
).pipe(Command.withDescription('Build design tokens from YAML source files'))
