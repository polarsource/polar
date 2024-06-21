'use server'

import {
  BundledLanguage,
  Highlighter,
  getHighlighter as _getHighlighter,
  bundledLanguages,
} from 'shiki'

export type { Highlighter }

export const getHighlighter = async (): Promise<Highlighter> => {
  return _getHighlighter({
    langs: Object.keys(bundledLanguages),
    themes: ['catppuccin-latte', 'catppuccin-mocha'],
  })
}

const SyntaxHighlighterServer = async ({
  lang,
  code,
  highlighter,
}: {
  lang: BundledLanguage
  code: string
  highlighter: Highlighter
}) => {
  const html = highlighter.codeToHtml(code, {
    lang,
    themes: {
      light: 'catppuccin-latte',
      dark: 'catppuccin-mocha',
    },
  })

  return <div dangerouslySetInnerHTML={{ __html: html }}></div>
}

export default SyntaxHighlighterServer
