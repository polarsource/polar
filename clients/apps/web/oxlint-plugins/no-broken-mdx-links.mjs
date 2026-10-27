import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'

const PAGE_FILE = /^page\.(tsx?|jsx?|mdx?)$/
const MDX_FILE = /\.mdx?$/
const FENCED_CODE = /^```[\s\S]*?^```/gm
const LINK = /\]\(\s*<?([^\s)>]+)|href=["']([^"']+)["']/g
const DOCS_PATH = /^\/docs(\/|$)/

const toSegments = (directory) =>
  directory
    .split(sep)
    .filter(
      (segment) =>
        segment &&
        segment !== '.' &&
        !/^\(.+\)$/.test(segment) &&
        !segment.startsWith('@') &&
        !segment.startsWith('_'),
    )

const toRoute = (directory) => '/' + toSegments(directory).join('/')

const toRoutePattern = (directory) => {
  const pattern = toSegments(directory)
    .map((segment) => {
      if (segment.startsWith('[[...')) return '(?:/.*)?'
      if (segment.startsWith('[...')) return '/.+'
      if (segment.startsWith('[')) return '/[^/]+'
      return `/${RegExp.escape(segment)}`
    })
    .join('')
  return new RegExp(`^${pattern || '/'}$`)
}

const noBrokenMdxLinks = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require internal links in the MDX pages under this layout to point at a page or public file that exists.',
    },
    schema: [],
    messages: {
      missing:
        '{{file}}:{{line}} links to "{{href}}", but no page or public file exists at {{path}}.',
    },
  },
  create(context) {
    const sectionDirectory = dirname(context.filename)
    const appDirectory = sectionDirectory.slice(
      0,
      sectionDirectory.lastIndexOf(`${sep}app${sep}`) + 4,
    )
    const publicDirectory = join(appDirectory, '..', '..', 'public')
    const routes = readdirSync(appDirectory, { recursive: true })
      .filter((file) => PAGE_FILE.test(basename(file)))
      .map((file) => toRoutePattern(dirname(file)))
    const isPublicFile = (path) => {
      try {
        return statSync(
          join(publicDirectory, decodeURIComponent(path)),
        ).isFile()
      } catch {
        return false
      }
    }
    const exists = (path) =>
      routes.some((route) => route.test(path)) || isPublicFile(path)

    return {
      Program(node) {
        for (const file of readdirSync(sectionDirectory, { recursive: true })) {
          if (!MDX_FILE.test(file)) continue
          const pageRoute = toRoute(
            relative(appDirectory, join(sectionDirectory, dirname(file))),
          )
          const content = readFileSync(
            join(sectionDirectory, file),
            'utf8',
          ).replace(FENCED_CODE, (block) => block.replace(/[^\n]/g, ''))
          for (const match of content.matchAll(LINK)) {
            const href = match[1] ?? match[2]
            const url = URL.parse(href, `https://polar.sh${pageRoute}`)
            if (url?.host !== 'polar.sh') continue
            const path = url.pathname.replace(/(.)\/$/, '$1')
            if (DOCS_PATH.test(path) || exists(path)) continue
            context.report({
              node,
              messageId: 'missing',
              data: {
                file: relative(context.cwd, join(sectionDirectory, file)),
                line: content.slice(0, match.index).split('\n').length,
                href,
                path,
              },
            })
          }
        }
      },
    }
  },
}

export default noBrokenMdxLinks
