import { themeConfig, themesList, transformers } from '@polar/shiki'
import {
  Highlighter,
  getHighlighter as _getHighlighter,
  bundledLanguages,
} from 'shiki'

export type { Highlighter }

let highlighter: Highlighter | null = null

export const getHighlighter = async (): Promise<Highlighter> => {
  if (highlighter) {
    return highlighter
  }
  highlighter = await _getHighlighter({
    langs: Object.keys(bundledLanguages),
    themes: themesList,
  })
  return highlighter
}

const SyntaxHighlighterServer = ({
  lang,
  code,
  highlighter,
}: {
  lang: string
  code: string
  highlighter: Highlighter
}) => {
  const html = highlighter.codeToHtml(code, {
    lang,
    themes: themeConfig,
    transformers,
  })
  return <div dangerouslySetInnerHTML={{ __html: html }}></div>
}

export default SyntaxHighlighterServer
