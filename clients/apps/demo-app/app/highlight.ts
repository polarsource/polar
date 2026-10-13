import { codeToHtml } from 'shiki'
import { STEPS, type Step } from './steps'

const MARKER = /\s*\/\/ !$/

const highlight = (code: string) => {
  const lines = code.split('\n')
  const marked = new Set(
    lines.flatMap((line, index) => (MARKER.test(line) ? [index + 1] : [])),
  )

  return codeToHtml(lines.map((line) => line.replace(MARKER, '')).join('\n'), {
    lang: 'ts',
    theme: 'github-dark-default',
    transformers: [
      {
        line(node, line) {
          if (marked.has(line)) this.addClassToHast(node, 'marked')
        },
      },
    ],
  })
}

export type HighlightedSteps = Record<Step, { name: string; html: string }[]>

const highlightAll = async (): Promise<HighlightedSteps> =>
  Object.fromEntries(
    await Promise.all(
      STEPS.map(async (step) => [
        step.id,
        await Promise.all(
          step.files.map(async ({ name, code }) => ({
            name,
            html: await highlight(code),
          })),
        ),
      ]),
    ),
  )

// The snippets are static, so highlight them once per server process
let highlighted: Promise<HighlightedSteps> | undefined

export const highlightSteps = () => (highlighted ??= highlightAll())
